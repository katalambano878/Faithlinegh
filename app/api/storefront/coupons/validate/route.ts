import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCoupon } from '@/lib/checkout-pricing';

/** Checks a coupon code for the coupon box. The order total is still recomputed at checkout. */
export async function POST(request: Request) {
  const limit = checkRateLimit(`coupon:${getClientIdentifier(request)}`, RATE_LIMITS.notification);
  if (!limit.success) return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
  try {
    const { code, subtotal } = await request.json();
    if (typeof code !== 'string' || !code.trim()) return NextResponse.json({ error: 'Enter a coupon code.' }, { status: 400 });
    const result = await validateCoupon(code.slice(0, 40), Math.max(0, Number(subtotal) || 0));
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ coupon: result.coupon });
  } catch {
    return NextResponse.json({ error: 'Could not check the coupon. Please try again.' }, { status: 500 });
  }
}
