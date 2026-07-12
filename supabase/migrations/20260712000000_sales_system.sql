-- ============================================================================
-- SALES (bulk discount campaign) SYSTEM
--
-- Pricing model:
--   price            = what the customer pays (discounted while on sale)
--   compare_at_price = the regular / "was" price, held ONLY while on sale
--   on_sale (bool)   = explicit campaign flag on products (variants infer
--                      "on sale" from compare_at_price > price)
--
-- Golden rule: the regular price is always DERIVED from current values:
--   regular = CASE WHEN compare_at_price IS NOT NULL AND compare_at_price > price
--                  THEN compare_at_price ELSE price END
-- so re-applying discounts never compounds, and removal restores the original.
-- ============================================================================

-- ── 1. products.on_sale + partial index + backfill ─────────────────────────

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS on_sale boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_on_sale
  ON public.products (on_sale) WHERE on_sale = true;

UPDATE public.products
SET on_sale = true
WHERE compare_at_price IS NOT NULL AND compare_at_price > price AND on_sale = false;

-- ── 2. Master switch storage ────────────────────────────────────────────────

INSERT INTO public.site_settings (key, value, category)
VALUES ('sales_active', 'true'::jsonb, 'sales')
ON CONFLICT (key) DO NOTHING;

-- ── 3. apply_sale_percentage ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_sale_percentage(p_ids uuid[], p_pct numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variants integer := 0;
  v_products integer := 0;
BEGIN
  IF p_pct IS NULL OR p_pct <= 0 OR p_pct >= 100 THEN
    RAISE EXCEPTION 'Percentage must be strictly between 0 and 100';
  END IF;

  -- Variants of the selected products
  WITH regs AS (
    SELECT v.id,
           CASE WHEN v.compare_at_price IS NOT NULL AND v.compare_at_price > v.price
                THEN v.compare_at_price ELSE v.price END AS regular
    FROM public.product_variants v
    WHERE v.product_id = ANY(p_ids)
  ), upd AS (
    UPDATE public.product_variants v
    SET compare_at_price = r.regular,
        price = round(r.regular * (1 - p_pct / 100), 2),
        updated_at = now()
    FROM regs r
    WHERE v.id = r.id AND r.regular > 0
    RETURNING 1
  )
  SELECT count(*) INTO v_variants FROM upd;

  -- The products themselves (keeps products.price mirrored for variant products,
  -- since the same % applies to the product's own derived regular price)
  WITH regs AS (
    SELECT p.id,
           CASE WHEN p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price
                THEN p.compare_at_price ELSE p.price END AS regular
    FROM public.products p
    WHERE p.id = ANY(p_ids)
  ), upd AS (
    UPDATE public.products p
    SET compare_at_price = r.regular,
        price = round(r.regular * (1 - p_pct / 100), 2),
        on_sale = true,
        updated_at = now()
    FROM regs r
    WHERE p.id = r.id AND r.regular > 0
    RETURNING 1
  )
  SELECT count(*) INTO v_products FROM upd;

  RETURN jsonb_build_object('products', v_products, 'variants', v_variants);
END;
$$;

-- ── 4. apply_sale_fixed (products WITHOUT variants only) ───────────────────

CREATE OR REPLACE FUNCTION public.apply_sale_fixed(p_ids uuid[], p_price numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applied integer := 0;
  v_eligible integer := 0;
  v_skipped_has_variants integer := 0;
  v_skipped_price integer := 0;
BEGIN
  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'Fixed sale price must be positive';
  END IF;

  SELECT count(*) INTO v_skipped_has_variants
  FROM public.products p
  WHERE p.id = ANY(p_ids)
    AND EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id);

  SELECT count(*) INTO v_eligible
  FROM public.products p
  WHERE p.id = ANY(p_ids)
    AND NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id);

  WITH regs AS (
    SELECT p.id,
           CASE WHEN p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price
                THEN p.compare_at_price ELSE p.price END AS regular
    FROM public.products p
    WHERE p.id = ANY(p_ids)
      AND NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id)
  ), upd AS (
    UPDATE public.products p
    SET compare_at_price = r.regular,
        price = p_price,
        on_sale = true,
        updated_at = now()
    FROM regs r
    WHERE p.id = r.id AND p_price < r.regular
    RETURNING 1
  )
  SELECT count(*) INTO v_applied FROM upd;

  v_skipped_price := v_eligible - v_applied;

  RETURN jsonb_build_object(
    'products', v_applied,
    'skipped', v_skipped_has_variants + v_skipped_price,
    'skipped_has_variants', v_skipped_has_variants,
    'skipped_price_not_below_regular', v_skipped_price
  );
END;
$$;

-- ── 5. apply_sale_variant_prices ────────────────────────────────────────────
-- p_items: [{ "variant_id": uuid, "price": numeric }, ...]

CREATE OR REPLACE FUNCTION public.apply_sale_variant_prices(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
  v_products integer := 0;
  v_total integer := 0;
  v_product_ids uuid[];
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  v_total := jsonb_array_length(p_items);

  WITH items AS (
    SELECT (i->>'variant_id')::uuid AS variant_id,
           (i->>'price')::numeric AS sale_price
    FROM jsonb_array_elements(p_items) i
  ), regs AS (
    SELECT v.id, i.sale_price,
           CASE WHEN v.compare_at_price IS NOT NULL AND v.compare_at_price > v.price
                THEN v.compare_at_price ELSE v.price END AS regular
    FROM public.product_variants v
    JOIN items i ON i.variant_id = v.id
  ), upd AS (
    UPDATE public.product_variants v
    SET compare_at_price = r.regular,
        price = r.sale_price,
        updated_at = now()
    FROM regs r
    WHERE v.id = r.id
      AND r.sale_price > 0
      AND r.sale_price < r.regular
    RETURNING v.product_id
  )
  SELECT count(*), array_agg(DISTINCT product_id)
  INTO v_updated, v_product_ids
  FROM upd;

  -- Sync parent products: flag on_sale, stash regular, mirror cheapest variant price
  IF v_product_ids IS NOT NULL THEN
    UPDATE public.products p
    SET on_sale = true,
        compare_at_price = CASE WHEN p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price
                                THEN p.compare_at_price ELSE p.price END,
        price = m.min_price,
        updated_at = now()
    FROM (
      SELECT product_id, min(price) AS min_price
      FROM public.product_variants
      WHERE product_id = ANY(v_product_ids)
      GROUP BY product_id
    ) m
    WHERE p.id = m.product_id;
    GET DIAGNOSTICS v_products = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'variants', v_updated,
    'products', v_products,
    'skipped', v_total - v_updated
  );
END;
$$;

-- ── 6. remove_sale ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.remove_sale(p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variants integer := 0;
  v_products integer := 0;
BEGIN
  -- Restore discounted variants to their regular price
  UPDATE public.product_variants v
  SET price = v.compare_at_price,
      compare_at_price = NULL,
      metadata = coalesce(v.metadata, '{}'::jsonb) - 'paused_sale_price',
      updated_at = now()
  WHERE v.product_id = ANY(p_ids)
    AND v.compare_at_price IS NOT NULL
    AND v.compare_at_price > v.price;
  GET DIAGNOSTICS v_variants = ROW_COUNT;

  -- Restore products and clear the campaign flag
  UPDATE public.products p
  SET price = coalesce(p.compare_at_price, p.price),
      compare_at_price = NULL,
      on_sale = false,
      metadata = coalesce(p.metadata, '{}'::jsonb) - 'paused_sale_price',
      updated_at = now()
  WHERE p.id = ANY(p_ids)
    AND p.on_sale = true;
  GET DIAGNOSTICS v_products = ROW_COUNT;

  RETURN jsonb_build_object('products', v_products, 'variants', v_variants);
END;
$$;

-- ── 7. Master switch: pause / resume (reversible, idempotent) ───────────────

CREATE OR REPLACE FUNCTION public.pause_all_sales()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variants integer := 0;
  v_products integer := 0;
BEGIN
  -- Variants of campaign products: stash sale price, restore regular
  UPDATE public.product_variants v
  SET metadata = coalesce(v.metadata, '{}'::jsonb)
                   || jsonb_build_object('paused_sale_price', v.price),
      price = v.compare_at_price,
      compare_at_price = NULL,
      updated_at = now()
  FROM public.products p
  WHERE v.product_id = p.id
    AND p.on_sale = true
    AND v.compare_at_price IS NOT NULL
    AND v.compare_at_price > v.price
    AND NOT (coalesce(v.metadata, '{}'::jsonb) ? 'paused_sale_price');
  GET DIAGNOSTICS v_variants = ROW_COUNT;

  -- Products: stash sale price, restore regular. on_sale STAYS true.
  UPDATE public.products p
  SET metadata = coalesce(p.metadata, '{}'::jsonb)
                   || jsonb_build_object('paused_sale_price', p.price),
      price = p.compare_at_price,
      compare_at_price = NULL,
      updated_at = now()
  WHERE p.on_sale = true
    AND p.compare_at_price IS NOT NULL
    AND p.compare_at_price > p.price
    AND NOT (coalesce(p.metadata, '{}'::jsonb) ? 'paused_sale_price');
  GET DIAGNOSTICS v_products = ROW_COUNT;

  RETURN jsonb_build_object('products', v_products, 'variants', v_variants);
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_all_sales()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variants integer := 0;
  v_products integer := 0;
BEGIN
  UPDATE public.product_variants v
  SET compare_at_price = v.price,
      price = (v.metadata->>'paused_sale_price')::numeric,
      metadata = v.metadata - 'paused_sale_price',
      updated_at = now()
  WHERE v.metadata ? 'paused_sale_price';
  GET DIAGNOSTICS v_variants = ROW_COUNT;

  UPDATE public.products p
  SET compare_at_price = p.price,
      price = (p.metadata->>'paused_sale_price')::numeric,
      metadata = p.metadata - 'paused_sale_price',
      updated_at = now()
  WHERE p.metadata ? 'paused_sale_price';
  GET DIAGNOSTICS v_products = ROW_COUNT;

  RETURN jsonb_build_object('products', v_products, 'variants', v_variants);
END;
$$;

-- ── 8. Lock down: service_role only ─────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.apply_sale_percentage(uuid[], numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sale_fixed(uuid[], numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sale_variant_prices(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_sale(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pause_all_sales() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resume_all_sales() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_sale_percentage(uuid[], numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_sale_fixed(uuid[], numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_sale_variant_prices(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_sale(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.pause_all_sales() TO service_role;
GRANT EXECUTE ON FUNCTION public.resume_all_sales() TO service_role;
