import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { createStorefrontOrder } from '@/lib/create-order';

/** Website checkout: creates the order from what the shopper chose (prices are worked out on the server). */
export async function POST(request: Request) {
  const limit = checkRateLimit(`checkout:${getClientIdentifier(request)}`, RATE_LIMITS.payment);
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Signed-in shopper (optional): verify the session token ourselves
  let userId: string | null = null;
  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
    userId = data?.user?.id ?? null;
  }

  const result = await createStorefrontOrder({
    items: body?.items,
    contact: body?.contact || {},
    delivery: body?.delivery || {},
    paymentChannel: body?.paymentChannel,
    couponCode: body?.couponCode,
    userId,
    saveAddress: !!body?.saveAddress,
    source: 'web',
  });

  if (!result.ok) {
    const { status, ...rest } = result;
    return NextResponse.json(rest, { status });
  }
  return NextResponse.json({
    orderNumber: result.orderNumber,
    accessToken: result.accessToken,
    total: result.total,
    subtotal: result.subtotal,
    bundleSavings: result.bundleSavings,
    couponDiscount: result.couponDiscount,
    deliveryFeePending: result.deliveryFeePending,
  });
}
