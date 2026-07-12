import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminOrStaffUser } from '@/lib/server-auth';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const MAX_BATCH = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validUuids(ids: unknown): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BATCH) return null;
  const cleaned = ids.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id));
  return cleaned.length === ids.length ? cleaned : null;
}

async function getSalesActive(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('site_settings')
    .select('value')
    .eq('key', 'sales_active')
    .maybeSingle();
  // Default ON when the setting row is missing
  return data ? data.value === true || data.value === 'true' : true;
}

async function setSalesActive(active: boolean) {
  const { error } = await supabaseAdmin
    .from('site_settings')
    .upsert(
      { key: 'sales_active', value: active, category: 'sales', updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) throw new Error(`Failed to save sales_active: ${error.message}`);
}

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
  }
  const user = await getAdminOrStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body?.action;

  try {
    // ── Master switch ───────────────────────────────────────────────────
    if (action === 'set_active') {
      const active = body.active;
      if (typeof active !== 'boolean') {
        return NextResponse.json({ error: '`active` must be a boolean' }, { status: 400 });
      }
      const rpcName = active ? 'resume_all_sales' : 'pause_all_sales';
      const { data, error } = await supabaseAdmin.rpc(rpcName);
      if (error) throw new Error(error.message);
      await setSalesActive(active);
      return NextResponse.json({ success: true, active, counts: data ?? {} });
    }

    // Every other action requires sales to be ON (editing while paused
    // would create an inconsistent mixed state)
    const salesActive = await getSalesActive();
    if (!salesActive) {
      return NextResponse.json(
        { error: 'Turn sales on before editing individual product sales' },
        { status: 409 }
      );
    }

    // ── Apply % or fixed price ──────────────────────────────────────────
    if (action === 'apply') {
      const productIds = validUuids(body.productIds);
      if (!productIds) {
        return NextResponse.json({ error: `productIds must be 1-${MAX_BATCH} valid UUIDs` }, { status: 400 });
      }
      const value = Number(body.value);

      if (body.mode === 'percentage') {
        if (!Number.isFinite(value) || value < 1 || value > 99) {
          return NextResponse.json({ error: 'Percentage must be between 1 and 99' }, { status: 400 });
        }
        const { data, error } = await supabaseAdmin.rpc('apply_sale_percentage', {
          p_ids: productIds,
          p_pct: value,
        });
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, counts: data ?? {} });
      }

      if (body.mode === 'fixed') {
        if (!Number.isFinite(value) || value <= 0) {
          return NextResponse.json({ error: 'Fixed price must be greater than 0' }, { status: 400 });
        }
        const { data, error } = await supabaseAdmin.rpc('apply_sale_fixed', {
          p_ids: productIds,
          p_price: value,
        });
        if (error) throw new Error(error.message);
        const counts = (data ?? {}) as Record<string, number>;
        const notes: string[] = [];
        if (counts.skipped_has_variants > 0) {
          notes.push(`${counts.skipped_has_variants} skipped (has variants — set per-variant sale prices instead)`);
        }
        if (counts.skipped_price_not_below_regular > 0) {
          notes.push(`${counts.skipped_price_not_below_regular} skipped (price not below regular price)`);
        }
        return NextResponse.json({
          success: true,
          counts,
          skipped: counts.skipped ?? 0,
          note: notes.length ? notes.join('; ') : undefined,
        });
      }

      return NextResponse.json({ error: 'mode must be "percentage" or "fixed"' }, { status: 400 });
    }

    // ── Per-variant sale prices ─────────────────────────────────────────
    if (action === 'variant_prices') {
      const items = body.items;
      if (!Array.isArray(items) || items.length === 0 || items.length > MAX_BATCH) {
        return NextResponse.json({ error: `items must be 1-${MAX_BATCH} entries` }, { status: 400 });
      }
      const payload: { variant_id: string; price: number }[] = [];
      for (const item of items) {
        const variantId = item?.variantId;
        const price = Number(item?.price);
        if (typeof variantId !== 'string' || !UUID_RE.test(variantId) || !Number.isFinite(price) || price <= 0) {
          return NextResponse.json({ error: 'Each item needs a valid variantId and a positive price' }, { status: 400 });
        }
        payload.push({ variant_id: variantId, price });
      }
      const { data, error } = await supabaseAdmin.rpc('apply_sale_variant_prices', {
        p_items: payload,
      });
      if (error) throw new Error(error.message);
      const counts = (data ?? {}) as Record<string, number>;
      return NextResponse.json({
        success: true,
        counts,
        skipped: counts.skipped ?? 0,
        note: counts.skipped > 0
          ? `${counts.skipped} variant price(s) skipped (not strictly below the regular price)`
          : undefined,
      });
    }

    // ── Remove sale ─────────────────────────────────────────────────────
    if (action === 'remove') {
      const productIds = validUuids(body.productIds);
      if (!productIds) {
        return NextResponse.json({ error: `productIds must be 1-${MAX_BATCH} valid UUIDs` }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin.rpc('remove_sale', { p_ids: productIds });
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, counts: data ?? {} });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/admin/sales] error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

/** GET returns the master switch state + sale counts for the admin UI. */
export async function GET(request: Request) {
  const user = await getAdminOrStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const [active, totalRes, onSaleRes] = await Promise.all([
      getSalesActive(),
      supabaseAdmin.from('products').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('on_sale', true),
    ]);
    return NextResponse.json({
      active,
      total: totalRes.count ?? 0,
      onSale: onSaleRes.count ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
