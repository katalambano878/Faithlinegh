import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/storefront/coupons/redeem
 * Increments a coupon's usage count after it was used on an order.
 * Body: { code: string, orderNumber: string }
 */
export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const orderNumber = typeof body?.orderNumber === 'string' ? body.orderNumber.trim() : '';
  if (!code || !orderNumber) {
    return NextResponse.json({ error: 'code and orderNumber are required' }, { status: 400 });
  }

  // Only count usage for orders that actually exist and reference this coupon
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, metadata')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (!order || String(order.metadata?.coupon_code || '').toLowerCase() !== code.toLowerCase()) {
    return NextResponse.json({ error: 'Order not found for this coupon' }, { status: 404 });
  }
  if (order.metadata?.coupon_redeemed === true) {
    return NextResponse.json({ success: true, alreadyCounted: true });
  }

  const { data: coupon } = await supabaseAdmin
    .from('coupons')
    .select('id, usage_count')
    .ilike('code', code)
    .maybeSingle();

  if (!coupon) {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
  }

  await supabaseAdmin
    .from('coupons')
    .update({ usage_count: (coupon.usage_count || 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', coupon.id);

  await supabaseAdmin
    .from('orders')
    .update({ metadata: { ...(order.metadata || {}), coupon_redeemed: true } })
    .eq('id', order.id);

  return NextResponse.json({ success: true });
}
