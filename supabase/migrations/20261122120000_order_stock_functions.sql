-- Order and stock functions (2026-11-22), part 1 of 2.
-- Safe to apply while the old site code is still running: it only adds
-- functions and relaxes variant foreign keys.
--
-- 1. mark_order_paid locks the order, deducts stock once, and deducts
--    colour x size variants by variant id (it used to match the size name
--    only, so variant stock never went down).
-- 2. merge_order_metadata adds keys to an order without overwriting others.
-- 3. restock_order puts stock back when a paid order is cancelled or refunded.
-- 4. get_order_for_tracking returns the delivery method and never the private token.
-- 5. Deleting a variant no longer fails because an order references it.

begin;

-- ── Variant links survive variant deletes ───────────────────────────────
alter table public.order_items drop constraint if exists order_items_variant_id_fkey;
alter table public.order_items add constraint order_items_variant_id_fkey
  foreign key (variant_id) references public.product_variants(id) on delete set null;
do $$ begin
  if to_regclass('public.cart_items') is not null then
    alter table public.cart_items drop constraint if exists cart_items_variant_id_fkey;
    alter table public.cart_items add constraint cart_items_variant_id_fkey
      foreign key (variant_id) references public.product_variants(id) on delete set null;
  end if;
end $$;

-- ── Merge into order metadata without overwriting other keys ────────────
create or replace function public.merge_order_metadata(p_order_id uuid, p_patch jsonb)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  update orders set metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb), updated_at = now()
  where id = p_order_id
  returning metadata;
$$;

-- ── Mark paid: lock, deduct once, deduct variants by id ─────────────────
create or replace function public.mark_order_paid(order_ref text, moolre_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o orders;
begin
  select * into o from orders where order_number = order_ref for update;
  if o.id is null then
    return null;
  end if;

  update orders set
    payment_status = 'paid',
    status = case when status in ('pending', 'awaiting_payment') then 'processing'::order_status else status end,
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('payment_verified_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      || case when moolre_ref is not null then jsonb_build_object('moolre_reference', moolre_ref) else '{}'::jsonb end,
    updated_at = now()
  where id = o.id;

  if coalesce((o.metadata->>'stock_reduced')::boolean, false) = false then
    -- Product totals: one deduction per product, summed across its lines
    update products p
       set quantity = greatest(0, p.quantity - t.qty)
      from (select product_id, sum(quantity) as qty from order_items where order_id = o.id group by product_id) t
     where p.id = t.product_id;

    -- Variants: by variant id when the line has one
    update product_variants pv
       set quantity = greatest(0, pv.quantity - t.qty)
      from (select variant_id, sum(quantity) as qty from order_items where order_id = o.id and variant_id is not null group by variant_id) t
     where pv.id = t.variant_id;

    -- Older lines without a variant id: match "Colour / Size", then a bare size or colour
    update product_variants pv
       set quantity = greatest(0, pv.quantity - t.qty)
      from (
        select oi.product_id, oi.variant_name, sum(oi.quantity) as qty
          from order_items oi
         where oi.order_id = o.id and oi.variant_id is null and oi.variant_name is not null
         group by oi.product_id, oi.variant_name
      ) t
     where pv.product_id = t.product_id
       and (
         (position(' / ' in t.variant_name) > 0
            and trim(pv.option2) = trim(split_part(t.variant_name, ' / ', 1))
            and trim(pv.name) = trim(split_part(t.variant_name, ' / ', 2)))
         or (position(' / ' in t.variant_name) = 0 and trim(pv.name) = trim(t.variant_name))
       );

    update orders set metadata = metadata || '{"stock_reduced": true}'::jsonb where id = o.id;
  end if;

  select * into o from orders where id = o.id;
  return to_jsonb(o);
end;
$function$;

-- ── Put stock back when a paid order is cancelled or refunded ───────────
create or replace function public.restock_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o orders;
begin
  select * into o from orders where id = p_order_id for update;
  if o.id is null or coalesce((o.metadata->>'stock_reduced')::boolean, false) = false then
    return false;
  end if;

  update products p
     set quantity = p.quantity + t.qty
    from (select product_id, sum(quantity) as qty from order_items where order_id = o.id group by product_id) t
   where p.id = t.product_id;

  update product_variants pv
     set quantity = pv.quantity + t.qty
    from (select variant_id, sum(quantity) as qty from order_items where order_id = o.id and variant_id is not null group by variant_id) t
   where pv.id = t.variant_id;

  update product_variants pv
     set quantity = pv.quantity + t.qty
    from (
      select oi.product_id, oi.variant_name, sum(oi.quantity) as qty
        from order_items oi
       where oi.order_id = o.id and oi.variant_id is null and oi.variant_name is not null
       group by oi.product_id, oi.variant_name
    ) t
   where pv.product_id = t.product_id
     and (
       (position(' / ' in t.variant_name) > 0
          and trim(pv.option2) = trim(split_part(t.variant_name, ' / ', 1))
          and trim(pv.name) = trim(split_part(t.variant_name, ' / ', 2)))
       or (position(' / ' in t.variant_name) = 0 and trim(pv.name) = trim(t.variant_name))
     );

  update orders
     set metadata = metadata || jsonb_build_object('stock_reduced', false, 'restocked_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
         updated_at = now()
   where id = o.id;
  return true;
end;
$function$;

-- ── Order tracking: add delivery method, never return the private token ─
create or replace function public.get_order_for_tracking(p_order_number text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE o public.orders; items jsonb; result jsonb; search_term text;
BEGIN
  search_term := trim(p_order_number);
  IF search_term = '' OR p_email IS NULL OR trim(p_email) = '' THEN RETURN NULL; END IF;
  SELECT * INTO o FROM public.orders WHERE order_number = search_term LIMIT 1;
  IF o.id IS NULL THEN SELECT * INTO o FROM public.orders WHERE metadata->>'tracking_number' = search_term LIMIT 1; END IF;
  IF o.id IS NULL THEN RETURN NULL; END IF;
  IF lower(trim(o.email)) <> lower(trim(p_email)) THEN RETURN NULL; END IF;
  SELECT jsonb_agg(jsonb_build_object('id', oi.id, 'product_name', oi.product_name, 'variant_name', oi.variant_name,
    'quantity', oi.quantity, 'unit_price', oi.unit_price,
    'metadata', COALESCE(oi.metadata, '{}'::jsonb) || jsonb_build_object('image',
      COALESCE(oi.metadata->>'image', (SELECT pi.url FROM public.product_images pi WHERE pi.product_id = oi.product_id ORDER BY pi.position LIMIT 1)))))
  INTO items FROM public.order_items oi WHERE oi.order_id = o.id;
  IF items IS NULL THEN items := '[]'::jsonb; END IF;
  result := jsonb_build_object('id', o.id, 'order_number', o.order_number, 'status', o.status,
    'payment_status', o.payment_status, 'total', o.total, 'email', o.email,
    'shipping_method', o.shipping_method, 'shipping_total', o.shipping_total,
    'created_at', o.created_at, 'shipping_address', COALESCE(o.shipping_address, '{}'::jsonb),
    'metadata', COALESCE(o.metadata, '{}'::jsonb) - 'access_token', 'order_items', items);
  RETURN result;
END;
$function$;

-- The new functions run from the server only, from the start
revoke all on function public.merge_order_metadata(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.restock_order(uuid) from public, anon, authenticated;
grant execute on function public.merge_order_metadata(uuid, jsonb) to service_role;
grant execute on function public.restock_order(uuid) to service_role;

commit;
