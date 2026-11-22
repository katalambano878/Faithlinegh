#!/bin/bash
# Final copy of Faithline's data from Supabase (supabase-vps, "acme") into
# store_faithline on big-vps. Run during the maintenance window, right before
# the DNS switch. Same steps as the tested first copy; stops on any error.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
D=migration-artifacts/dumps
SRC_DB=supabase-db-i116kh2vhb2v950cl8oyiko5
PSQL='source /data/fleet/secrets/db-stack.env; docker exec -i -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d store_faithline'
COLS="instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,invited_at,confirmation_token,confirmation_sent_at,recovery_token,recovery_sent_at,email_change_token_new,email_change,email_change_sent_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at,phone,phone_confirmed_at,phone_change,phone_change_token,phone_change_sent_at,confirmed_at,email_change_token_current,email_change_confirm_status,banned_until,reauthentication_token,reauthentication_sent_at,is_sso_user,deleted_at,is_anonymous"

echo "== 1. fresh dump"
ssh supabase-vps "docker exec $SRC_DB pg_dump -U postgres -d postgres --schema=public --no-owner --no-privileges --no-publications --no-subscriptions" > $D/public_final.sql
grep -v "^CREATE SCHEMA public;$" $D/public_final.sql \
  | sed -e 's/extensions\.uuid_generate_v4()/gen_random_uuid()/g' -e 's/extensions\.gin_trgm_ops/public.gin_trgm_ops/g' > $D/public_final_ready.sql
test "$(grep -c 'extensions\.' $D/public_final_ready.sql || true)" = "0"

echo "== 2. reset store_faithline"
ssh big-vps "$PSQL" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO store_faithline;
DROP SCHEMA IF EXISTS auth CASCADE;
SQL
ssh big-vps "$PSQL" < migration-artifacts/sql/00_base.sql

echo "== 3. logins"
ssh supabase-vps "docker exec $SRC_DB psql -U postgres -d postgres -c \"\\copy (select $COLS from auth.users) to stdout\"" \
  | ssh big-vps "$PSQL -c \"\\copy auth.users($COLS) from stdin\""

echo "== 4. store tables + data"
ssh big-vps "$PSQL --single-transaction" < $D/public_final_ready.sql > /dev/null

echo "== 5. ownership, trigger, photo links"
ssh big-vps "$PSQL --single-transaction" < migration-artifacts/sql/90_after_load.sql 2>&1 | grep -v "does not exist, skipping" || true

echo "== 6. the new site is not in maintenance"
ssh big-vps "$PSQL -c \"update store_settings set value = 'false'::jsonb where key = 'maintenance_mode';\""

echo "== 7. parity"
Q="select 'T|'||relname||'|'||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', relname), false, true, '')))[1]::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and relname <> 'store_settings' union all select 'X|functions|'||count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') union all select 'X|triggers|'||count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth') and not t.tgisinternal union all select 'X|auth.users|'||count(*) from auth.users order by 1;"
ssh supabase-vps "docker exec -i $SRC_DB psql -U postgres -At" <<< "$Q" > $D/parity_src.txt
ssh big-vps 'source /data/fleet/secrets/db-stack.env; docker exec -i -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres psql -U postgres -d store_faithline -At' <<< "$Q" > $D/parity_dst.txt
if diff -q $D/parity_src.txt $D/parity_dst.txt > /dev/null; then
  echo "PARITY OK: $(grep -c '^T' $D/parity_dst.txt) tables, $(awk -F'|' '$1=="T"{s+=$3} END{print s}' $D/parity_dst.txt) rows, $(grep auth.users $D/parity_dst.txt)"
else
  echo "PARITY MISMATCH:"; diff $D/parity_src.txt $D/parity_dst.txt; exit 1
fi
