import { NextResponse } from 'next/server';
import { createRecoveryToken } from '@/lib/db/auth';
import { sendEmail, emailLayout, emailButton } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * Emails a one-hour password reset link. Always answers "ok" so the form
 * never reveals whether an email address has an account.
 */
export async function POST(request: Request) {
  const limit = checkRateLimit(`forgot:${getClientIdentifier(request)}`, { maxRequests: 5, windowSeconds: 600 });
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({} as any));
  const email = String(body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email' }, { status: 400 });
  }
  if (body?.recaptchaToken) {
    const human = await verifyRecaptcha(String(body.recaptchaToken), 'forgot_password');
    if (!human.success) {
      return NextResponse.json({ error: 'Security check failed. Please try again.' }, { status: 400 });
    }
  }

  try {
    const made = await createRecoveryToken(email);
    if (made) {
      const link = `${SITE_URL}/auth/reset-password?token=${encodeURIComponent(made.token)}`;
      await sendEmail({
        to: made.email,
        subject: 'Reset your Faithlinegh password',
        html: emailLayout(
          `<h1 style="font-size:22px;margin:0 0 12px;">Reset your password</h1>
<p style="margin:0 0 8px;">We got a request to reset the password for your Faithlinegh account.</p>
<p style="margin:0 0 20px;">Tap the button to choose a new one. The link works once and expires in 1 hour.</p>
${emailButton('Choose a new password', link)}
<p style="margin:20px 0 0;font-size:13px;color:#6b7280;">If you didn't ask for this, you can ignore this email. Your password stays the same.</p>`,
          'Reset your Faithlinegh password'
        ),
      });
    }
  } catch (e: any) {
    console.error('[forgot-password]', e?.message);
  }
  return NextResponse.json({ ok: true });
}
