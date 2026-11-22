import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function getAccessToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/\bsb-access-token=([^;]+)/);
  if (match) return decodeURIComponent(match[1].trim());
  const authCookie = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('sb-') && (c.includes('-auth-token') || c.includes('auth')));
  if (!authCookie) return null;
  const value = authCookie.split('=').slice(1).join('=').trim();
  const decoded = decodeURIComponent(value);
  try {
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    if (parsed?.access_token) return parsed.access_token;
    if (typeof parsed === 'string') return parsed;
  } catch {
    return decoded;
  }
  return null;
}

async function requireAdmin(request: Request): Promise<NextResponse | null> {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
  }
  const token = getAccessToken(request);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = profile?.role != null ? String(profile.role) : '';
  if (role !== 'admin' && role !== 'staff') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

/**
 * GET /api/admin/products/[id]
 * Fetches a single product with variants and images using service role (bypasses RLS).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = await requireAdmin(request);
  if (err) return err;

  const { id: productId } = await params;
  if (!productId) {
    return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        categories(id, name),
        product_variants(*),
        product_images(*)
      `)
      .eq('id', productId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Product not found' }, { status: 404 });
    }

    if (Array.isArray(data.product_variants)) {
      data.product_variants.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    return NextResponse.json({ product: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch product' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/products/[id]
 * Updates a product and syncs its variants in place using the service role (bypasses RLS).
 * Handles duplicate slug by appending a numeric suffix.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = await requireAdmin(request);
  if (err) return err;

  const { id: productId } = await params;
  if (!productId) {
    return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { variants = [], ...productData } = body;

    // Ensure slug uniqueness (ignore the current product)
    let slug: string = productData.slug || productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let slugCandidate = slug;
    let attempt = 1;
    while (true) {
      const { data: existing } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('slug', slugCandidate)
        .neq('id', productId)
        .maybeSingle();
      if (!existing) break;
      attempt++;
      slugCandidate = `${slug}-${attempt}`;
    }
    productData.slug = slugCandidate;

    // Keep metadata keys this form doesn't edit (merge, don't replace)
    const { data: current } = await supabaseAdmin
      .from('products').select('metadata, slug').eq('id', productId).single();
    if (productData.metadata && typeof productData.metadata === 'object') {
      productData.metadata = { ...(current?.metadata || {}), ...productData.metadata };
    }
    // Renamed web address: remember the old one so shared links still open the product
    if (current?.slug && productData.slug && current.slug !== productData.slug) {
      const meta = productData.metadata && typeof productData.metadata === 'object' ? productData.metadata : { ...(current.metadata || {}) };
      const previous: string[] = Array.isArray(meta.previous_slugs) ? meta.previous_slugs : [];
      meta.previous_slugs = [...new Set([...previous, current.slug])].filter(s => s !== productData.slug).slice(-10);
      productData.metadata = meta;
    }
    if (productData.price !== undefined) {
      const cmp = Number(productData.compare_at_price);
      productData.on_sale = cmp > 0 && cmp > Number(productData.price);
    }
    productData.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update(productData)
      .eq('id', productId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Variants: update rows in place (keeps their ids, so carts, orders and
    // WhatsApp drafts that point at them stay valid), add new ones, remove
    // the ones taken out of the form.
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('product_variants').select('id, name, option2, metadata').eq('product_id', productId);
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    const existing = existingRows || [];
    const keyOf = (color: string | null | undefined, size: string | null | undefined) =>
      `${(color || '').trim().toLowerCase()}|||${(size || '').trim().toLowerCase()}`;
    const byId = new Map(existing.map((r: any) => [r.id, r]));
    const byKey = new Map(existing.map((r: any) => {
      const size = r.name && r.name !== r.option2 ? r.name : '';
      return [keyOf(r.option2, size), r];
    }));
    const kept = new Set<string>();
    const inserts: any[] = [];

    for (let idx = 0; idx < variants.length; idx++) {
      const v = variants[idx];
      const color = v.color?.trim() || null;
      const size = (v.name || '').trim() || null;
      const match: any = (v.id && byId.get(v.id)) || byKey.get(keyOf(color, size));
      const row = {
        name: size || color || 'Default',
        sku: v.sku || null,
        price: parseFloat(v.price) || 0,
        quantity: Math.max(0, parseInt(v.stock) || 0),
        option1: size,
        option2: color,
        image_url: v.image_url?.trim() || null,
        sort_order: v.sort_order ?? idx,
        metadata: { ...((match?.metadata as object) || {}), ...(v.colorHex ? { color_hex: v.colorHex } : {}) },
      };
      if (match && !kept.has(match.id)) {
        kept.add(match.id);
        const { error } = await supabaseAdmin.from('product_variants')
          .update({ ...row, updated_at: new Date().toISOString() }).eq('id', match.id);
        if (error) return NextResponse.json({ error: `Could not save ${row.name}: ${error.message}` }, { status: 500 });
      } else {
        inserts.push({ product_id: productId, ...row });
      }
    }

    for (let i = 0; i < inserts.length; i += 100) {
      const { error } = await supabaseAdmin.from('product_variants').insert(inserts.slice(i, i + 100));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const removed = existing.filter((r: any) => !kept.has(r.id)).map((r: any) => r.id);
    if (removed.length) {
      await supabaseAdmin.from('cart_items').delete().in('variant_id', removed);
      const { error } = await supabaseAdmin.from('product_variants').delete().in('id', removed);
      if (error) {
        // An old order still points at it: keep the row but take it off sale
        await supabaseAdmin.from('product_variants').update({ quantity: 0 }).in('id', removed);
        console.warn('[admin products] variant kept for order history:', error.message);
      }
    }

    return NextResponse.json({ ok: true, slug: productData.slug });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update product' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/products/[id]
 * Deletes a product and its dependent rows (images, variants, cart/wishlist, reviews).
 * Fails with 400 if the product has order history.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = await requireAdmin(request);
  if (err) return err;

  const { id: productId } = await params;
  if (!productId) {
    return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
  }

  try {
    const { data: orderItems } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('product_id', productId)
      .limit(1);
    if (orderItems && orderItems.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product that has been ordered. Consider archiving it instead.' },
        { status: 400 }
      );
    }

    await supabaseAdmin.from('cart_items').delete().eq('product_id', productId);
    await supabaseAdmin.from('wishlist_items').delete().eq('product_id', productId);

    const { data: reviews } = await supabaseAdmin.from('reviews').select('id').eq('product_id', productId);
    if (reviews?.length) {
      const reviewIds = reviews.map((r) => r.id);
      await supabaseAdmin.from('review_images').delete().in('review_id', reviewIds);
      await supabaseAdmin.from('reviews').delete().eq('product_id', productId);
    }

    await supabaseAdmin.from('product_images').delete().eq('product_id', productId);
    await supabaseAdmin.from('product_variants').delete().eq('product_id', productId);

    const { error } = await supabaseAdmin.from('products').delete().eq('id', productId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete product' }, { status: 500 });
  }
}
