-- Secure checkout, orders and coupons (2026-11-22), part 2 of 2.
-- Apply only AFTER the new site code is live: the old code created orders
-- with the public key, which this removes.
--
-- 1. Orders and order items can no longer be created or read by the public
--    key: the storefront creates them through /api/storefront/checkout with
--    the service role. Customers still read their own orders when signed in.
-- 2. Payment and customer functions run only from the server.
-- 3. Coupons are checked by the server, so the table is no longer public.

begin;

-- ── Orders ──────────────────────────────────────────────────────────────
drop policy if exists orders_insert on public.orders;
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select using ((select auth.uid()) = user_id or public.is_admin_or_staff());
drop policy if exists orders_insert_admin on public.orders;
create policy orders_insert_admin on public.orders
  for insert with check (public.is_admin_or_staff());

-- ── Order items ─────────────────────────────────────────────────────────
drop policy if exists order_items_insert on public.order_items;
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    public.is_admin_or_staff()
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = (select auth.uid()))
  );

-- ── Coupons ─────────────────────────────────────────────────────────────
drop policy if exists coupons_select_active on public.coupons;

-- Public key: read-only at most (row policies above decide what it sees)
revoke insert, update, delete, truncate, references, trigger on public.orders, public.order_items, public.coupons from anon;
revoke truncate, references, trigger on public.orders, public.order_items, public.coupons from authenticated;

-- ── Server-only functions ───────────────────────────────────────────────
revoke all on function public.mark_order_paid(text, text) from public, anon, authenticated;
revoke all on function public.merge_order_metadata(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.restock_order(uuid) from public, anon, authenticated;
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('upsert_customer_from_order', 'update_customer_stats', 'mark_order_paid')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
grant execute on function public.merge_order_metadata(uuid, jsonb) to service_role;
grant execute on function public.restock_order(uuid) to service_role;

commit;
