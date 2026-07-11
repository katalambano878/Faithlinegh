import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

const RETURN_WINDOW_DAYS = 30;

/**
 * Public returns portal endpoint.
 * Ownership is proven the same way as order tracking: the caller must
 * supply the order number AND the email the order was placed with.
 */
export async function POST(req: NextRequest) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(`returns:${clientId}`, RATE_LIMITS.notification);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const { orderNumber, email, items, returnType, description } = body || {};

    if (!orderNumber || !email || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order number, email and at least one item are required' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, email, status, user_id, created_at, order_items(id, product_name, quantity)')
      .eq('order_number', String(orderNumber).trim())
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (String(order.email || '').toLowerCase().trim() !== String(email).toLowerCase().trim()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!['delivered', 'completed'].includes(order.status)) {
      return NextResponse.json({ error: 'Only delivered orders can be returned' }, { status: 400 });
    }

    const ageDays = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > RETURN_WINDOW_DAYS) {
      return NextResponse.json({ error: `Returns are only accepted within ${RETURN_WINDOW_DAYS} days of purchase` }, { status: 400 });
    }

    // Validate every requested item belongs to this order
    const orderItemIds = new Set((order.order_items || []).map((i: any) => i.id));
    for (const item of items) {
      if (!item.order_item_id || !orderItemIds.has(item.order_item_id) || !item.reason) {
        return NextResponse.json({ error: 'Invalid return items' }, { status: 400 });
      }
    }

    // Reject duplicate open return requests for the same order
    const { data: existing } = await supabaseAdmin
      .from('return_requests')
      .select('id')
      .eq('order_id', order.id)
      .in('status', ['pending', 'approved'])
      .limit(1);
    if (existing?.length) {
      return NextResponse.json({ error: 'A return request for this order is already in progress' }, { status: 409 });
    }

    const reasonSummary = items.map((i: any) => i.reason).filter(Boolean).join('; ');

    const { data: ret, error: retError } = await supabaseAdmin
      .from('return_requests')
      .insert({
        order_id: order.id,
        user_id: order.user_id || null,
        status: 'pending',
        reason: reasonSummary || 'Not specified',
        description: [returnType === 'exchange' ? 'Requested: exchange' : 'Requested: refund', description]
          .filter(Boolean).join('\n'),
      })
      .select('id, status')
      .single();

    if (retError || !ret) {
      console.error('[Returns API] Insert error:', retError?.message);
      return NextResponse.json({ error: 'Failed to create return request' }, { status: 500 });
    }

    const returnItems = items.map((i: any) => ({
      return_request_id: ret.id,
      order_item_id: i.order_item_id,
      quantity: Math.max(1, parseInt(i.quantity) || 1),
      reason: i.reason,
    }));
    const { error: itemsError } = await supabaseAdmin.from('return_items').insert(returnItems);
    if (itemsError) {
      console.error('[Returns API] Items insert error:', itemsError.message);
    }

    return NextResponse.json({
      success: true,
      return_id: ret.id,
      order_number: order.order_number,
      status: ret.status,
    }, { status: 201 });
  } catch (err: any) {
    console.error('[Returns API] Error:', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
