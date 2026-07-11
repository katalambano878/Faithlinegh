-- The storefront/admin APIs select and write product_variants.sort_order,
-- but the original schema never defined it. Add it so variant ordering works.
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
