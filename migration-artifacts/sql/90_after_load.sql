-- Step 9: after the public schema + data and auth.users are loaded.
-- Run as postgres in store_faithline.

\set ON_ERROR_STOP on

-- New accounts get a profile row (same trigger as on Supabase)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- The app enforces access itself (lib/db/rest-acl.ts); row level security
-- policies refer to Supabase JWTs that don't exist here.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- The store role owns the store's objects, like every other store DB on big-vps
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename AS n FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO store_faithline', r.n);
  END LOOP;
  FOR r IN SELECT c.relname AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
            WHERE s.nspname = 'public' AND c.relkind = 'S'
              AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a','i')) LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO store_faithline', r.n);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS f FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
            WHERE s.nspname = 'public'
              AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO store_faithline', r.f);
  END LOOP;
  FOR r IN SELECT t.typname AS n FROM pg_type t JOIN pg_namespace s ON s.oid = t.typnamespace
            WHERE s.nspname = 'public' AND t.typtype = 'e' LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO store_faithline', r.n);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO store_faithline;
GRANT USAGE ON SCHEMA auth TO store_faithline;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO store_faithline;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), auth.jwt() TO store_faithline;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO store_faithline;

-- Photo links: Supabase storage host -> the site's own /storage route
DO $$
DECLARE r record; old_prefix text := 'https://acme-api.89-116-30-71.nip.io/storage/v1/object/public/';
BEGIN
  FOR r IN SELECT c.table_name, c.column_name, CASE WHEN c.data_type = 'ARRAY' AND c.udt_name <> '_text' THEN 'skip' ELSE c.data_type END AS data_type FROM information_schema.columns c
            JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
            WHERE c.table_schema = 'public' AND c.data_type IN ('text', 'character varying', 'jsonb', 'ARRAY') LOOP
    IF r.data_type = 'jsonb' THEN
      EXECUTE format('UPDATE public.%I SET %I = replace(%I::text, %L, %L)::jsonb WHERE %I::text LIKE %L',
        r.table_name, r.column_name, r.column_name, old_prefix, '/storage/v1/object/public/', r.column_name, '%' || old_prefix || '%');
    ELSIF r.data_type = 'skip' THEN
      NULL;
    ELSIF r.data_type = 'ARRAY' THEN
      EXECUTE format('UPDATE public.%I SET %I = string_to_array(replace(array_to_string(%I, chr(31)), %L, %L), chr(31)) WHERE array_to_string(%I, chr(31)) LIKE %L',
        r.table_name, r.column_name, r.column_name, old_prefix, '/storage/v1/object/public/', r.column_name, '%' || old_prefix || '%');
    ELSE
      EXECUTE format('UPDATE public.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
        r.table_name, r.column_name, r.column_name, old_prefix, '/storage/v1/object/public/', r.column_name, '%' || old_prefix || '%');
    END IF;
  END LOOP;
END $$;
