-- Faithline tracking codes (2026-11-22)
-- Orders placed before the template clean-up carry SLI- codes (and one has
-- none). Give every order an FL- code, keep the old code as
-- legacy_tracking_number, and let tracking lookups accept either one.

begin;

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
  IF o.id IS NULL THEN
    SELECT * INTO o FROM public.orders
     WHERE upper(metadata->>'tracking_number') = upper(search_term)
        OR upper(metadata->>'legacy_tracking_number') = upper(search_term)
     LIMIT 1;
  END IF;
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

-- Old SLI- codes become FL- with the same six characters
update public.orders
   set metadata = metadata
         || jsonb_build_object('legacy_tracking_number', metadata->>'tracking_number')
         || jsonb_build_object('tracking_number', 'FL-' || substr(metadata->>'tracking_number', 5)),
       updated_at = now()
 where metadata->>'tracking_number' like 'SLI-%'
   and not exists (
     select 1 from public.orders o2
      where o2.metadata->>'tracking_number' = 'FL-' || substr(orders.metadata->>'tracking_number', 5)
   );

-- Orders with no code get a new FL- code
update public.orders
   set metadata = coalesce(metadata, '{}'::jsonb)
         || jsonb_build_object('tracking_number', 'FL-' || upper(substr(md5(id::text || random()::text), 1, 6))),
       updated_at = now()
 where coalesce(metadata->>'tracking_number', '') = '';

commit;
