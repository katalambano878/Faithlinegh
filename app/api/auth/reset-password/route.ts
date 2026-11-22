import { NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/db/auth';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limit = checkRateLimit(`reset:${getClientIdentifier(request)}`, { maxRequests: 10, windowSeconds: 600 });
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
  }
  const body = await request.json().catch(() => ({} as any));
  const { ok, error } = await resetPasswordWithToken(String(body?.token || ''), String(body?.password || ''));
  if (!ok) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
