import { supabaseAdmin as dbAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = dbAdmin;
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'maintenance_countdown_minutes')
      .single();

    // Value is stored as JSONB — could be a JSON-encoded string like "30" or a number
    let raw: unknown = data?.value;
    if (typeof raw === 'string') raw = raw.replace(/"/g, '');
    const minutes = raw != null ? parseInt(String(raw), 10) : 30;

    return NextResponse.json({
      countdownMinutes: isNaN(minutes) ? 30 : Math.max(1, minutes),
    });
  } catch {
    return NextResponse.json({ countdownMinutes: 30 });
  }
}
