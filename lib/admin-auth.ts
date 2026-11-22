import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sanitizePermissions } from '@/lib/admin-permissions';

/**
 * Admin API access, using the same rules as the admin sidebar:
 * admins open every screen; staff open a screen when their permissions
 * (custom ones on their profile, else their role's) allow it.
 */

export type TeamMember = {
  id: string;
  role: 'admin' | 'staff';
  name: string;
  email: string;
  permissions: Record<string, boolean>;
};

function getAccessToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/\bsb-access-token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export async function getTeamMember(request: Request): Promise<TeamMember | null> {
  const token = getAccessToken(request);
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name, email, permissions')
    .eq('id', user.id)
    .single();
  const role = profile?.role != null ? String(profile.role) : '';
  if (role !== 'admin' && role !== 'staff') return null;

  const { data: roleConfig } = await supabaseAdmin
    .from('roles')
    .select('permissions, enabled')
    .eq('id', role)
    .maybeSingle();
  if (roleConfig && roleConfig.enabled === false) return null;

  const custom = sanitizePermissions(profile?.permissions);
  const permissions = role === 'staff' && Object.keys(custom).length > 0
    ? custom
    : sanitizePermissions(roleConfig?.permissions);

  return {
    id: user.id,
    role: role as 'admin' | 'staff',
    name: profile?.full_name || user.email?.split('@')[0] || 'Staff',
    email: profile?.email || user.email || '',
    permissions,
  };
}

export async function requireScreen(
  request: Request,
  screenKey: string,
  opts: { adminOnly?: boolean } = {}
): Promise<{ member: TeamMember; error?: undefined } | { error: NextResponse; member?: undefined }> {
  if (!process.env.DATABASE_URL) {
    return { error: NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 }) };
  }
  const member = await getTeamMember(request);
  if (!member) return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) };
  if (member.role === 'admin') return { member };
  const allowed = !opts.adminOnly && (Object.keys(member.permissions).length === 0 || member.permissions[screenKey] === true);
  if (!allowed) {
    return { error: NextResponse.json({ error: 'You do not have access to this screen.' }, { status: 403 }) };
  }
  return { member };
}
