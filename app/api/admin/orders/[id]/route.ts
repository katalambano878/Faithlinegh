import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
  }
  const token = getAccessToken(request);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role != null ? String(profile.role) : '';
  if (role !== 'admin' && role !== 'staff') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

const ORDER_SELECT = `
  *,
  order_items (
    id,
    product_id,
    product_name,
    variant_id,
    variant_name,
    sku,
    quantity,
    unit_price,
    total_price,
    metadata,
    products (
      product_images (url)
    )
  )
`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = await requireAdmin(request);
  if (err) return err;

  const { id } = await params;

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let data: any = null;

    if (isUUID) {
      const { data: d, error } = await supabaseAdmin
        .from('orders').select(ORDER_SELECT).eq('id', id).single();
      if (!error) data = d;
    }

    if (!data) {
      const { data: d, error } = await supabaseAdmin
        .from('orders').select(ORDER_SELECT).eq('order_number', id).single();
      if (error) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      data = d;
    }

    return NextResponse.json({ order: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

const ORDER_STATUSES = ['pending', 'awaiting_payment', 'processing', 'shipped', 'dispatched_to_rider', 'delivered', 'cancelled', 'refunded'];

/**
 * Admin order update. Only status, notes and the courier reference can be
 * changed here; other order details (tracking code, payment, prices) stay
 * as recorded. Metadata is merged, never replaced. Cancelling or refunding
 * a paid order puts its stock back.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = await requireAdmin(request);
  if (err) return err;

  const { id } = await params;

  try {
    const body = await request.json();
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('orders').select('id, status, order_number, payment_status').eq('id', id).single();
    if (fetchError || !current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const update: Record<string, any> = {};
    if (body.status !== undefined) {
      if (!ORDER_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Unknown order status' }, { status: 400 });
      }
      update.status = body.status;
    }
    if (body.notes !== undefined) update.notes = body.notes == null ? null : String(body.notes).slice(0, 5000);

    if (Object.keys(update).length) {
      update.updated_at = new Date().toISOString();
      const { error } = await supabaseAdmin.from('orders').update(update).eq('id', id);
      if (error) throw error;
    }

    if (body.courier_reference !== undefined) {
      const { error } = await supabaseAdmin.rpc('merge_order_metadata', {
        p_order_id: id,
        p_patch: { courier_reference: String(body.courier_reference || '').trim().slice(0, 120) },
      });
      if (error) throw error;
    }

    let restocked = false;
    if (update.status && ['cancelled', 'refunded'].includes(update.status) && !['cancelled', 'refunded'].includes(current.status)) {
      const { data, error } = await supabaseAdmin.rpc('restock_order', { p_order_id: id });
      if (error) console.error('[admin orders] restock failed:', error.message);
      restocked = data === true;
    }

    // Re-opening a paid order that was cancelled or refunded: take its stock out again
    let restockedOut = false;
    if (update.status && !['cancelled', 'refunded'].includes(update.status)
        && ['cancelled', 'refunded'].includes(current.status) && current.payment_status === 'paid') {
      const { error } = await supabaseAdmin.rpc('mark_order_paid', { order_ref: current.order_number, moolre_ref: null });
      if (error) console.error('[admin orders] re-deduct failed:', error.message);
      else restockedOut = true;
    }

    return NextResponse.json({ success: true, restocked, restockedOut });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
