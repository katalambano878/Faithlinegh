import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireScreen } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** Staff expense notes. Admins see everyone's; staff see their own. */
export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'expenses');
  if (auth.error) return auth.error;

  const admin = auth.member.role === 'admin';
  let q = supabaseAdmin
    .from('staff_expenses')
    .select('id, user_id, staff_name, staff_email, amount, description, spent_on, created_at')
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300);
  if (!admin) q = q.eq('user_id', auth.member.id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not load expenses.' }, { status: 500 });
  return NextResponse.json({
    expenses: (data || []).map((e: any) => ({ ...e, amount: Number(e.amount) || 0 })),
    canSeeAll: admin,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireScreen(request, 'expenses');
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 400) : '';
  const amount = Number(body.amount);
  const spentOn = typeof body.spentOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.spentOn)
    ? body.spentOn
    : new Date().toISOString().slice(0, 10);

  if (!description) return NextResponse.json({ error: 'Write what the money was used for.' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json({ error: 'Enter the amount in cedis.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('staff_expenses')
    .insert({
      user_id: auth.member.id,
      staff_name: auth.member.name,
      staff_email: auth.member.email,
      amount: Math.round(amount * 100) / 100,
      description,
      spent_on: spentOn,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: 'Could not save the expense.' }, { status: 500 });
  return NextResponse.json({ id: data?.id, message: 'Expense recorded.' });
}
