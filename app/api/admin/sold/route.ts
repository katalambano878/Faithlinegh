import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireScreen } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

type ClosedPeriod = { id: string; start: string | null; end: string; revenue: number; orders: number; itemsSold: number; closedBy: string };

const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Stock periods (optional): when stock was last taken. Missing means "since the store opened". */
async function readStockPeriods(): Promise<{ currentStart: string | null; history: ClosedPeriod[] }> {
  const { data } = await supabaseAdmin.from('site_settings').select('value').eq('key', 'stock_periods').maybeSingle();
  const raw: any = data?.value && typeof data.value === 'object' ? data.value : {};
  const history = Array.isArray(raw.history) ? raw.history : [];
  return {
    currentStart: isIso(raw.currentStart) ? raw.currentStart : null,
    history: history
      .filter((p: any) => p && isIso(p.end))
      .map((p: any) => ({
        id: String(p.id || p.end),
        start: isIso(p.start) ? p.start : null,
        end: String(p.end),
        revenue: Number(p.revenue) || 0,
        orders: Number(p.orders) || 0,
        itemsSold: Number(p.itemsSold) || 0,
        closedBy: typeof p.closedBy === 'string' ? p.closedBy : '',
      })),
  };
}

/** Accra is UTC+0 all year, so a calendar day is a plain UTC range. */
const dayStart = (day: string) => `${day}T00:00:00.000Z`;
function dayAfter(day: string): string {
  const next = new Date(dayStart(day));
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

/**
 * Everything sold in a range, product by product.
 * ?period=current (default) | all | <closed period id>, or ?from=YYYY-MM-DD&to=YYYY-MM-DD.
 */
export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'sold');
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const periods = await readStockPeriods();
  const fromDay = params.get('from') || '';
  const toDay = params.get('to') || '';
  const period = params.get('period') || 'current';

  let from: string | null = null;
  let to: string | null = null;
  let selected = period;

  if (fromDay || toDay) {
    if ((fromDay && !DAY.test(fromDay)) || (toDay && !DAY.test(toDay))) {
      return NextResponse.json({ error: 'Choose valid dates.' }, { status: 400 });
    }
    if (fromDay && toDay && fromDay > toDay) {
      return NextResponse.json({ error: 'The start date is after the end date.' }, { status: 400 });
    }
    from = fromDay ? dayStart(fromDay) : null;
    to = toDay ? dayAfter(toDay) : null;
    selected = 'custom';
  } else if (period === 'all') {
    selected = 'all';
  } else if (period === 'current') {
    from = periods.currentStart;
  } else {
    const closed = periods.history.find((p) => p.id === period);
    if (!closed) return NextResponse.json({ error: 'That stock period was not found.' }, { status: 404 });
    from = closed.start;
    to = closed.end;
  }

  const [totals, products] = await Promise.all([
    supabaseAdmin.rpc('admin_sales_totals', { p_from: from, p_to: to }),
    supabaseAdmin.rpc('admin_sold_by_product', { p_from: from, p_to: to }),
  ]);
  if (totals.error || products.error) {
    console.error('[sold]', totals.error?.message || products.error?.message);
    return NextResponse.json({ error: 'Could not load products sold.' }, { status: 500 });
  }
  const t: any = totals.data || {};

  return NextResponse.json({
    selected,
    range: { from, to },
    totals: {
      revenue: Number(t.revenue) || 0,
      orders: Number(t.orders) || 0,
      itemsSold: Number(t.itemsSold) || 0,
      itemsRevenue: Number(t.itemsRevenue) || 0,
    },
    products: products.data || [],
    currentStart: periods.currentStart,
    history: [...periods.history].reverse(),
  });
}
