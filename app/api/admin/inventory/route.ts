import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireScreen } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Set the stock of a product, or of one size/colour option.
 * Body: { productId, variantId?, quantity }. When an option changes, the
 * product's total is recalculated from its options.
 */
export async function PATCH(request: Request) {
  const auth = await requireScreen(request, 'inventory');
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const productId = String(body.productId || '');
  const variantId = body.variantId ? String(body.variantId) : null;
  const quantity = Math.floor(Number(body.quantity));
  if (!UUID.test(productId) || (variantId && !UUID.test(variantId))) {
    return NextResponse.json({ error: 'Pick a product.' }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 100000) {
    return NextResponse.json({ error: 'Enter a stock number from 0 up.' }, { status: 400 });
  }

  if (variantId) {
    const { error } = await supabaseAdmin
      .from('product_variants')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', variantId)
      .eq('product_id', productId);
    if (error) return NextResponse.json({ error: 'Could not save the stock.' }, { status: 500 });
    const { data: rows } = await supabaseAdmin.from('product_variants').select('quantity').eq('product_id', productId);
    const total = (rows || []).reduce((s, r: any) => s + (Number(r.quantity) || 0), 0);
    await supabaseAdmin.from('products').update({ quantity: total, updated_at: new Date().toISOString() }).eq('id', productId);
    return NextResponse.json({ ok: true, productTotal: total });
  }

  const { count } = await supabaseAdmin
    .from('product_variants')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  if ((count || 0) > 0) {
    return NextResponse.json({ error: 'This product has sizes or colours. Change the stock of each option.' }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from('products')
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq('id', productId);
  if (error) return NextResponse.json({ error: 'Could not save the stock.' }, { status: 500 });
  return NextResponse.json({ ok: true, productTotal: quantity });
}
