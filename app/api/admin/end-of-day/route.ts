import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireScreen } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const LOW_STOCK_AT = 5;

/** Accra is UTC+0 all year, so a calendar day is a plain UTC range. */
function pickDay(raw: string | null) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
}

export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'end_of_day');
  if (auth.error) return auth.error;

  const day = pickDay(request.nextUrl.searchParams.get('date'));
  const { data, error } = await supabaseAdmin.rpc('admin_end_of_day', { p_day: day });
  if (error || !data) {
    console.error('[end-of-day]', error?.message);
    return NextResponse.json({ error: 'Could not build the end of day report.' }, { status: 500 });
  }

  const r: any = data;
  const t: any = r.totals || {};
  const prior: any = r.prior || {};
  const isAdmin = auth.member.role === 'admin';
  const items = ((r.products as any[]) || []).map((p: any) => {
    const unitCost = p.unit_cost == null ? null : Number(p.unit_cost);
    return {
      productId: p.product_id,
      name: p.name,
      units: Number(p.units) || 0,
      posUnits: Number(p.pos_units) || 0,
      webUnits: Number(p.web_units) || 0,
      revenue: Number(p.revenue) || 0,
      stockLeft: p.stock_left,
      profit: unitCost == null ? null : (Number(p.revenue) || 0) - unitCost * (Number(p.units) || 0),
    };
  });
  const costed = items.filter((i) => i.profit != null);
  const num = (v: unknown) => Number(v) || 0;

  return NextResponse.json({
    day,
    summary: {
      paidOrders: num(t.paid_orders),
      unpaidOrders: num(t.unpaid_orders),
      cancelledOrders: num(t.cancelled_orders),
      cancelledPaidOrders: num(t.cancelled_paid_orders),
      cancelledPaidValue: num(t.cancelled_paid_value),
      posOrders: num(t.pos_orders),
      webOrders: num(t.web_orders),
      revenue: num(t.revenue),
      posRevenue: num(t.pos_revenue),
      webRevenue: num(t.web_revenue),
      discounts: num(t.discounts),
      toFulfil: num(t.to_fulfil),
      unitsSold: items.reduce((s, i) => s + i.units, 0),
      averageOrder: num(t.paid_orders) ? num(t.revenue) / num(t.paid_orders) : 0,
      profit: isAdmin && costed.length ? costed.reduce((s, i) => s + (i.profit || 0), 0) : null,
      profitCoverage: items.length ? costed.length / items.length : 0,
    },
    comparison: { yesterday: num(prior.yesterday), lastWeek: num(prior.last_week) },
    payments: r.payments || [],
    items: items.map((i) => (isAdmin ? i : { ...i, profit: null })),
    lowStock: items.filter((i) => i.stockLeft != null && i.stockLeft <= LOW_STOCK_AT),
    staff: r.staff || [],
    orders: r.orders || [],
  });
}
