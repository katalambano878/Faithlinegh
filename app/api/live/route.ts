import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { requireScreen } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** A shopper counts as live if their tab pinged within this window. */
const ACTIVE_WINDOW_SECONDS = 90;

function stageFor(page: string, cartItems: number): string {
  if (page.startsWith('/checkout') || page.startsWith('/pay')) return 'checkout';
  if (page.startsWith('/cart')) return 'cart';
  if (cartItems > 0) return 'has_bag';
  if (page.startsWith('/product/')) return 'viewing_product';
  return 'browsing';
}

/** Shopper's browser tab reports where it is (no personal details). */
export async function POST(request: NextRequest) {
  const limit = checkRateLimit(`live:${getClientIdentifier(request)}`, { maxRequests: 20, windowSeconds: 60 });
  if (!limit.success) return new NextResponse(null, { status: 204 });

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === 'string' ? body.visitorId.slice(0, 64) : '';
  if (!/^[a-z0-9-]{8,64}$/i.test(visitorId)) {
    return NextResponse.json({ error: 'Invalid visitor' }, { status: 400 });
  }
  const page = typeof body?.page === 'string' && body.page.startsWith('/') ? body.page.slice(0, 200) : '/';
  if (page.startsWith('/admin')) return new NextResponse(null, { status: 204 });

  const cartItems = Math.max(0, Math.min(999, Math.floor(Number(body?.cartItems) || 0)));
  const cartValue = Math.max(0, Math.min(1_000_000, Number(body?.cartValue) || 0));

  const { error } = await supabaseAdmin.rpc('admin_live_ping', {
    p_visitor: visitorId,
    p_page: page,
    p_stage: stageFor(page, cartItems),
    p_items: cartItems,
    p_value: cartValue,
  });
  if (error) console.error('[live] ping failed', error.message);
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'live');
  if (auth.error) return auth.error;

  const { data, error } = await supabaseAdmin.rpc('admin_live_summary', { p_window_seconds: ACTIVE_WINDOW_SECONDS });
  if (error || !data) {
    console.error('[live] load failed', error?.message);
    return NextResponse.json({ error: 'Could not load live shoppers.' }, { status: 500 });
  }

  const rows = ((data as any).sessions || []).map((r: any) => ({
    id: String(r.visitor_id).slice(-6),
    page: r.page,
    stage: r.stage,
    cartItems: Number(r.cart_items) || 0,
    cartValue: Number(r.cart_value) || 0,
    lastSeen: r.last_seen,
  }));

  return NextResponse.json({
    windowSeconds: ACTIVE_WINDOW_SECONDS,
    online: rows.length,
    withBag: rows.filter((r: any) => r.cartItems > 0).length,
    atCheckout: rows.filter((r: any) => r.stage === 'checkout').length,
    bagValue: rows.reduce((sum: number, r: any) => sum + r.cartValue, 0),
    today: {
      visitors: Number((data as any).visitors) || 0,
      webOrders: Number((data as any).web_orders) || 0,
      webRevenue: Number((data as any).web_revenue) || 0,
    },
    sessions: rows,
  });
}
