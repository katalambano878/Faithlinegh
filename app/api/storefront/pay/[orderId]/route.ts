import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  try {
    // Fetch order (by UUID or order_number)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (!isUUID && !/^[A-Z0-9-]{4,60}$/i.test(orderId)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    // Only what the pay page shows: no email, phone or address
    const query = supabaseAdmin
      .from('orders')
      .select('id, order_number, status, payment_status, currency, subtotal, discount_total, shipping_total, total, shipping_method, created_at, metadata, order_items(id, product_id, variant_id, product_name, variant_name, quantity, unit_price, metadata)');
    const { data: rawOrder, error: orderError } = isUUID
      ? await query.eq('id', orderId).single()
      : await query.eq('order_number', orderId).single();
    const order: any = rawOrder
      ? {
          ...rawOrder,
          metadata: {
            first_name: rawOrder.metadata?.first_name,
            tracking_number: rawOrder.metadata?.tracking_number,
            delivery_fee_pending: rawOrder.metadata?.delivery_fee_pending,
            payment_channel: rawOrder.metadata?.payment_channel,
          },
        }
      : null;

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Validate stock for every item in the order
    const outOfStockItems: string[] = [];

    if (order.order_items?.length) {
      for (const item of order.order_items) {
        if (!item.product_id) continue;

        // Fetch current product stock
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('quantity, track_quantity, status, name')
          .eq('id', item.product_id)
          .single();

        if (!product) {
          outOfStockItems.push(item.product_name || 'Unknown product');
          continue;
        }

        // Product is inactive / deleted
        if (product.status && product.status !== 'active') {
          outOfStockItems.push(item.product_name);
          continue;
        }

        // Check variant stock if variant metadata is available
        const variantId = item.variant_id || item.metadata?.variant_id;
        if (variantId) {
          const { data: variant } = await supabaseAdmin
            .from('product_variants')
            .select('quantity')
            .eq('id', variantId)
            .single();

          if (variant && typeof variant.quantity === 'number' && variant.quantity < item.quantity) {
            outOfStockItems.push(`${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ''}`);
            continue;
          }
        }

        // Check overall product stock (only when inventory tracking is on)
        if (product.track_quantity !== false && typeof product.quantity === 'number' && product.quantity < item.quantity) {
          outOfStockItems.push(item.product_name);
        }
      }
    }

    return NextResponse.json({
      order,
      stockValid: outOfStockItems.length === 0,
      outOfStockItems,
    });
  } catch (err: any) {
    console.error('[Pay API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
