import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .upsert(
        { email, subscribed: true, source: 'homepage', updated_at: new Date().toISOString() },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('Newsletter subscribe error:', error);
      return NextResponse.json({ error: 'Could not subscribe right now. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    return NextResponse.json({ error: 'Could not subscribe right now. Please try again.' }, { status: 500 });
  }
}
