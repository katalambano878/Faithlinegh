import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/** Login token from the app's cookies (bare JWT or a stored session JSON). */
function extractToken(request: NextRequest): string | undefined {
    let token =
        request.cookies.get('app-access-token')?.value ||
        request.cookies.get('sb-access-token')?.value;
    if (!token) {
        for (const [name, cookie] of request.cookies) {
            if ((name.startsWith('sb-') || name.startsWith('app-')) && (name.endsWith('-auth-token') || name.includes('auth'))) {
                try {
                    const parsed = JSON.parse(cookie.value);
                    if (Array.isArray(parsed) && parsed[0]) token = parsed[0];
                    else if (typeof parsed === 'object' && parsed?.access_token) token = parsed.access_token;
                    else if (typeof parsed === 'string') token = parsed;
                } catch {
                    token = cookie.value;
                }
                if (token) break;
            }
        }
    }
    return token;
}

/** Checks the token's signature and that it belongs to an admin or staff member. */
async function verifyAdmin(token: string): Promise<{ ok: boolean; expired?: boolean; userId?: string; role?: string }> {
    const secret = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
    if (!secret) return { ok: false };
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
        if (payload.typ === 'refresh') return { ok: false };
        const userId = typeof payload.sub === 'string' ? payload.sub : undefined;
        const role = ((payload.app_metadata || {}) as { role?: string }).role;
        if (!userId || (role !== 'admin' && role !== 'staff')) return { ok: false };
        return { ok: true, userId, role };
    } catch (err: any) {
        return { ok: false, expired: err?.code === 'ERR_JWT_EXPIRED' };
    }
}

// ============================================================
// Maintenance mode helper — cached for 15s to keep latency low
// ============================================================
let cachedMaintenance: { value: boolean; at: number } | null = null;
const MAINTENANCE_CACHE_TTL_MS = 15_000;

async function isMaintenanceModeEnabled(origin: string): Promise<boolean> {
    const now = Date.now();
    if (cachedMaintenance && now - cachedMaintenance.at < MAINTENANCE_CACHE_TTL_MS) {
        return cachedMaintenance.value;
    }
    try {
        // The app serves its own REST API; store_settings is publicly readable
        const res = await fetch(`${origin}/rest/v1/store_settings?key=eq.maintenance_mode&select=value&limit=1`, {
            headers: { apikey: 'anon' },
            cache: 'no-store',
        });
        const data: Array<{ value: unknown }> = await res.json();
        const raw = data?.[0]?.value;
        // Value is JSONB — could be the literal string "true" or the boolean true.
        const enabled =
            raw === true ||
            raw === 'true' ||
            (typeof raw === 'string' && raw.replace(/"/g, '').toLowerCase() === 'true');
        cachedMaintenance = { value: enabled, at: now };
        return enabled;
    } catch {
        return false;
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const response = NextResponse.next();

    // ============================================================
    // Security headers for ALL routes
    // ============================================================
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // ============================================================
    // Admin route protection (auth + role check)
    // ============================================================
    if (pathname.startsWith('/admin')) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

        if (pathname === '/admin/login') {
            return response;
        }

        const token = extractToken(request);
        if (!token) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(loginUrl);
        }

        const verified = await verifyAdmin(token);
        if (!verified.ok) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('redirect', pathname);
            loginUrl.searchParams.set('error', verified.expired ? 'session_expired' : 'unauthorized');
            return NextResponse.redirect(loginUrl);
        }
        // Disabled roles are refused by /api/admin/me, which the admin layout calls first
        if (verified.userId) response.headers.set('x-user-id', verified.userId);
        if (verified.role) response.headers.set('x-user-role', verified.role);

        return response;
    }

    // ============================================================
    // API + static + maintenance page itself: no maintenance gating
    // ============================================================
    // Public photos: cache for a day (never no-store, or every visit re-downloads them)
    if (pathname.startsWith('/storage/v1/object/public/')) {
        response.headers.set('Cache-Control', 'public, max-age=86400, immutable');
        return response;
    }
    if (pathname.startsWith('/rest/') || pathname.startsWith('/auth/v1') || pathname.startsWith('/storage/')) {
        response.headers.set('Cache-Control', 'no-store');
        return response;
    }

    if (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon') ||
        pathname === '/maintenance' ||
        /\.[^/]+$/.test(pathname) // any path with a file extension (.png, .ico, .json…)
    ) {
        if (pathname.startsWith('/api/')) {
            response.headers.set('Cache-Control', 'no-store');
        }
        return response;
    }

    // ============================================================
    // Storefront: maintenance gate
    // Admins/staff who logged in carry an `admin_session=1` cookie
    // (set client-side by the admin layout) and bypass the gate.
    // ============================================================
    const inMaintenance = await isMaintenanceModeEnabled(request.nextUrl.origin);
    if (inMaintenance) {
        const isAdmin = request.cookies.get('admin_session')?.value === '1';
        if (!isAdmin) {
            return NextResponse.redirect(new URL('/maintenance', request.url));
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image  (image optimization files)
         * - favicon.ico  (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
