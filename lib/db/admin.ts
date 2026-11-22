/**
 * Server-only Postgres admin client (in-process query builder).
 * NEVER import this from client components.
 */
import { createClient } from "./query-builder";
import { isPlainPostgres } from "./mode";

function createAdminClient() {
  if (!isPlainPostgres()) {
    throw new Error(
      "DATABASE_URL is required. Hosted Supabase fallback has been removed."
    );
  }
  return createClient();
}

export const dbAdmin: ReturnType<typeof createClient> = createAdminClient();
