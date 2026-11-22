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
  if (!process.env.DATABASE_URL) {
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

export async function GET(request: Request) {
  const err = await requireAdmin(request);
  if (err) return err;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');

    // Sales stats mode
    if (period !== null) {
      let startDate: string | null = null;
      const now = new Date();
      if (period === '24h') { const d = new Date(now); d.setHours(d.getHours() - 24); startDate = d.toISOString(); }
      else if (period === '7d') { const d = new Date(now); d.setDate(d.getDate() - 7); startDate = d.toISOString(); }
      else if (period === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); startDate = d.toISOString(); }

      // Paid, not-cancelled orders in the period, then their items. (The
      // database layer can't filter on a joined table's columns.)
      let oq = supabaseAdmin
        .from('orders')
        .select('id, created_at, status, payment_status')
        .eq('payment_status', 'paid')
        .neq('status', 'cancelled')
        .neq('status', 'refunded');
      if (startDate) oq = oq.gte('created_at', startDate);
      const { data: paidOrders, error: oErr } = await oq.limit(10000);
      if (oErr) throw oErr;
      const byId = new Map((paidOrders || []).map((o: any) => [o.id, o]));
      if (byId.size === 0) return NextResponse.json({ items: [] });

      const { data, error } = await supabaseAdmin
        .from('order_items')
        .select('order_id, quantity, product_name, product_id, variant_name, total_price')
        .in('order_id', Array.from(byId.keys()))
        .limit(10000);
      if (error) throw error;
      const items = (data || []).map(({ order_id, ...it }: any) => ({ ...it, orders: byId.get(order_id) }));
      return NextResponse.json({ items });
    }

    // Full orders list
    const { data: ordersData, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        email,
        total,
        status,
        payment_status,
        payment_method,
        shipping_method,
        created_at,
        phone,
        shipping_address,
        metadata,
        order_items (
          quantity,
          product_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ orders: ordersData || [] });
  } catch (e: any) {
    console.error('Admin orders API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
