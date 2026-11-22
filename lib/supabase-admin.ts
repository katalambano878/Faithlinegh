import { createClient } from './db/query-builder';

/**
 * Server-side database client (plain Postgres, in-process). Same calls as the
 * Supabase service-role client, so routes keep using supabaseAdmin.from(...).
 * ONLY use this in API routes and server components. It bypasses the REST
 * access rules, so always check who is calling first.
 */
export const supabaseAdmin: any = createClient();
