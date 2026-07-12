import { supabase } from '@/lib/supabase';

/** Authenticated fetch for admin API routes (Bearer + cookies). */
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);

    if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
    }

    return fetch(input, {
        ...init,
        credentials: 'include',
        headers,
    });
}
