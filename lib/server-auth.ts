import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/** Extract Supabase access token from Bearer header or auth cookies. */
export function getAccessTokenFromRequest(request: Request | NextRequest): string | null {
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

export async function getAdminOrStaffUser(request: Request | NextRequest, adminOnly = false) {
    const token = getAccessTokenFromRequest(request);
    if (!token) return null;

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single();

    if (!profile) return null;
    if (adminOnly && profile.role !== 'admin') return null;
    if (!adminOnly && profile.role !== 'admin' && profile.role !== 'staff') return null;

    return { ...user, role: profile.role, fullName: profile.full_name };
}
