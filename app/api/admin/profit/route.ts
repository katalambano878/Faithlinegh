import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireScreen } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Supplier cost per product, so the margin on each sale is known. */
export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'profit', { adminOnly: true });
  if (auth.error) return auth.error;

  const { data, error } = await supabaseAdmin.rpc('admin_profit_products');
  if (error) {
    console.error('[profit]', error.message);
    return NextResponse.json({ error: 'Could not load products.' }, { status: 500 });
  }

  const rows = ((data as any[]) || []).map((p: any) => {
    const price = Number(p.price) || 0;
    const compare = Number(p.compare_at_price) || 0;
    // What a shopper pays today: the cheapest option when variants carry their own price
    const sellingPrice = Number(p.min_variant_price) > 0 ? Math.min(Number(p.min_variant_price), price || Infinity) : price;
    const regularPrice = compare > sellingPrice ? compare : Math.max(price, sellingPrice);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      status: p.status,
      category: p.category,
      image: p.image,
      stock: p.quantity,
      regularPrice,
      sellingPrice,
      onPromotion: sellingPrice < regularPrice - 0.005,
      costPrice: p.cost_price,
      supplierName: p.supplier_name,
      notes: p.notes,
      costUpdatedAt: p.cost_updated_at,
      unitsSold30d: p.units_sold_30d,
    };
  });

  return NextResponse.json({ products: rows });
}

export async function PUT(request: NextRequest) {
  const auth = await requireScreen(request, 'profit', { adminOnly: true });
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === 'string' ? body.productId : '';
  if (!UUID.test(productId)) return NextResponse.json({ error: 'Pick a product.' }, { status: 400 });

  const supplierName = typeof body.supplierName === 'string' ? body.supplierName.trim().slice(0, 120) : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '';

  if (body.costPrice === null || body.costPrice === '') {
    await supabaseAdmin.from('product_costs').delete().eq('product_id', productId);
    return NextResponse.json({ message: 'Cost cleared.' });
  }

  const cost = Number(body.costPrice);
  if (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000) {
    return NextResponse.json({ error: 'Enter what you paid the supplier, in cedis.' }, { status: 400 });
  }

  const { data: product } = await supabaseAdmin.from('products').select('name').eq('id', productId).maybeSingle();
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  const { error } = await supabaseAdmin.from('product_costs').upsert({
    product_id: productId,
    supplier_name: supplierName || null,
    cost_price: Math.round(cost * 100) / 100,
    notes: notes || null,
    updated_by: auth.member.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: 'Could not save the cost.' }, { status: 500 });
  return NextResponse.json({ message: `Saved cost for ${product.name}.` });
}
