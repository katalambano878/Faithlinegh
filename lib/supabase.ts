/**
 * Browser/shared data client. Faithline runs on its own Postgres: this talks
 * to the app's /rest/v1, /auth/v1 and /storage/v1 routes (same origin),
 * with the same calls the Supabase client used.
 */
import { createAppClient } from './app-client';

export const supabase: any = createAppClient();
