import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Order details for the confirmation page.
 * Anyone with the order number sees the order itself (items, totals, status,
 * delivery method). Contact details and the address are returned only with
 * the order's private token (in the link Moolre redirects to, and saved in
 * the shopper's browser at checkout), or to the signed-in account that placed it.
 */
const PUBLIC_COLUMNS = 'id, order_number, status, payment_status, currency, subtotal, discount_total, shipping_total, total, shipping_method, created_at, user_id, metadata, order_items(id, product_name, variant_name, quantity, unit_price, total_price, metadata)';

function tokenMatches(given: string | null, expected: unknown): boolean {
  if (!given || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  if (!orderNumber || !/^[A-Z0-9-]{4,60}$/i.test(orderNumber)) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  const token = new URL(request.url).searchParams.get('t');

  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`${PUBLIC_COLUMNS}, email, phone, shipping_address`)
      .eq('order_number', orderNumber)
      .single();
    if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    let full = tokenMatches(token, order.metadata?.access_token);
    if (!full && order.user_id) {
      const auth = request.headers.get('authorization') || '';
      if (auth.startsWith('Bearer ')) {
        const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
        full = !!data?.user && data.user.id === order.user_id;
      }
    }
    const { email, phone, shipping_address, metadata, ...rest } = order as any;
    const safeMetadata = {
      tracking_number: metadata?.tracking_number,
      payment_channel: metadata?.payment_channel,
      delivery_fee_pending: metadata?.delivery_fee_pending,
      first_name: metadata?.first_name,
      coupon_code: metadata?.coupon_code,
    };
    return NextResponse.json({
      order: full
        ? { ...rest, email, phone, shipping_address, metadata: safeMetadata }
        : { ...rest, metadata: { ...safeMetadata, first_name: undefined } },
      full,
    });
  } catch (e: any) {
    console.error('Order fetch error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
