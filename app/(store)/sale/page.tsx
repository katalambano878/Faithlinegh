'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePageTitle } from '@/hooks/usePageTitle';
import ProductCard, { type ColorVariant } from '@/components/ProductCard';
import { getColorHex } from '@/components/ProductCard';
import { supabase } from '@/lib/supabase';
import PageHero from '@/components/PageHero';
import JsonLd from '@/components/JsonLd';
import { collectionPageSchema, breadcrumbSchema, SITE_NAME } from '@/lib/seo';
import { parseBundleTiers, formatBundleLabel } from '@/lib/bundle-pricing';

function formatProduct(p: any) {
  const variants = p.product_variants || [];
  const hasVariants = variants.length > 0;
  const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
  const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
  const effectiveStock = hasVariants ? totalVariantStock : p.quantity;
  const colorVariants: ColorVariant[] = [];
  const seenColors = new Set<string>();
  for (const v of variants) {
    const colorName = v.option2;
    if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
      const hex = getColorHex(colorName);
      if (hex) {
        seenColors.add(colorName.toLowerCase().trim());
        colorVariants.push({ name: colorName.trim(), hex });
      }
    }
  }
  const bundleTiers = parseBundleTiers(p.metadata?.bundle_pricing);
  const bestBundle = bundleTiers.filter((t) => t.qty > 1)[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    originalPrice: p.compare_at_price,
    image: p.product_images?.[0]?.url || 'https://via.placeholder.com/800x800?text=No+Image',
    rating: p.rating_avg || 0,
    reviewCount: 0,
    inStock: effectiveStock > 0,
    maxStock: effectiveStock || 50,
    moq: p.moq || 1,
    hasVariants,
    minVariantPrice,
    colorVariants,
    bundleLabel: bestBundle ? formatBundleLabel(bestBundle) : undefined,
    bundlePricing: bundleTiers.length > 0 ? bundleTiers : null,
  };
}

export default function SalePage() {
  usePageTitle('Sale — Deals & Discounts');
  const [products, setProducts] = useState<any[]>([]);
  const [salesActive, setSalesActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSale() {
      try {
        // Master switch: when OFF the sale page shows an empty state
        const { data: setting } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'sales_active')
          .maybeSingle();
        const active = setting ? setting.value === true || setting.value === 'true' : true;
        setSalesActive(active);
        if (!active) {
          setProducts([]);
          return;
        }

        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            categories(name, slug),
            product_images!product_id(url, position),
            product_variants(id, name, price, quantity, option1, option2, image_url)
          `)
          .eq('on_sale', true)
          .eq('status', 'active')
          .order('position', { foreignTable: 'product_images', ascending: true })
          .order('updated_at', { ascending: false });
        if (error) throw error;
        setProducts((data || []).map(formatProduct));
      } catch (err) {
        console.error('Error loading sale products:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSale();
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <JsonLd
        data={[
          collectionPageSchema({
            name: `Sale — ${SITE_NAME}`,
            description: 'Limited-time deals on bags, basics and dresses. Shop discounted pieces before they sell out.',
            url: '/sale',
          }),
          breadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'Sale', url: '/sale' },
          ]),
        ]}
      />
      <PageHero
        title="Sale"
        subtitle="Limited-time deals on your favourite pieces — grab them before they're gone."
        image="/hero-2.webp"
      />

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-brand-carton/20 bg-white p-3">
                  <div className="bg-brand-cream rounded-xl aspect-[4/5] animate-pulse" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-brand-carton/20 animate-pulse" />
                </div>
              ))}
            </div>
          ) : !salesActive || products.length === 0 ? (
            <div className="text-center py-24 px-6 rounded-3xl border border-brand-carton/20 bg-brand-cream/40">
              <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 bg-white rounded-full border border-brand-carton/20 shadow-sm">
                <i className="ri-price-tag-3-line text-4xl text-brand-carton" />
              </div>
              <h2 className="text-2xl font-bold text-brand-brown mb-2">No active sale right now</h2>
              <p className="text-brand-brown/80 mb-8">
                Check back soon — new deals drop regularly. In the meantime, explore the full collection.
              </p>
              <Link
                href="/shop"
                className="inline-flex items-center bg-brand-carton hover:bg-brand-brown text-white px-6 py-3 rounded-xl font-semibold transition-colors whitespace-nowrap"
              >
                Shop All Products
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8 flex items-center justify-between">
                <p className="text-gray-700">
                  <span className="font-bold text-brand-brown">{products.length}</span> item{products.length !== 1 ? 's' : ''} on sale
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
