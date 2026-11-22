import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import JsonLd from '@/components/JsonLd';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  pageMetadata,
  productSchema,
  breadcrumbSchema,
  toPlainText,
  SITE_NAME,
} from '@/lib/seo';

type ProductRow = {
  name: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  price: number;
  compare_at_price?: number | null;
  sku?: string | null;
  brand?: string | null;
  quantity?: number | null;
  track_quantity?: boolean | null;
  continue_selling?: boolean | null;
  tags?: string[] | null;
  rating_avg?: number | null;
  review_count?: number | null;
  categories?: { name: string; slug: string } | null;
  metadata?: Record<string, any> | null;
  product_variants?: { price: number | null; quantity: number | null }[] | null;
  product_images?: { url: string; position: number | null; alt_text: string | null }[] | null;
};

async function getProduct(slug: string): Promise<ProductRow | null> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    const { data } = await supabaseAdmin
      .from('products')
      .select(
        'name, slug, description, short_description, seo_title, seo_description, price, compare_at_price, sku, brand, quantity, track_quantity, continue_selling, tags, rating_avg, review_count, metadata, categories(name, slug), product_images(url, position, alt_text), product_variants(price, quantity)'
      )
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();
    return (data as unknown as ProductRow) || null;
  } catch {
    return null;
  }
}

/** A product's current address when `slug` is one it used before a rename. */
async function renamedSlug(slug: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('products')
      .select('slug')
      .contains('metadata', { previous_slugs: [slug] })
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    return data?.slug && data.slug !== slug ? data.slug : null;
  } catch {
    return null;
  }
}

/** Titles are stored without the brand; the layout adds " | Faithlinegh". */
function cleanTitle(t?: string | null): string {
  return String(t || '').replace(/\s*[|–—-]\s*faithline(gh)?\s*$/i, '').trim();
}

function productImages(p: ProductRow): string[] {
  const imgs = (p.product_images || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((i) => i.url)
    .filter(Boolean);
  return imgs;
}

function isInStock(p: ProductRow): boolean {
  if (p.track_quantity === false) return true;
  if (p.continue_selling) return true;
  const variants = p.product_variants || [];
  if (variants.some((v) => (v.quantity ?? 0) > 0)) return true;
  return (p.quantity ?? 0) > 0;
}

function priceRange(p: ProductRow): { low: number; high: number } {
  const prices = (p.product_variants || []).map((v) => Number(v.price) || 0).filter((n) => n > 0);
  const all = prices.length ? prices : [Number(p.price) || 0];
  return { low: Math.min(...all), high: Math.max(...all) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);

  if (!p) {
    const moved = await renamedSlug(slug);
    if (moved) return pageMetadata({ title: 'Moved', path: `/product/${moved}`, noindex: true });
    return pageMetadata({ title: 'Product Not Found', path: `/product/${slug}`, noindex: true });
  }

  const category = p.categories?.name;
  const description = toPlainText(
    p.seo_description ||
      p.short_description ||
      p.description ||
      `Shop ${p.name}${category ? ` (${category})` : ''} at ${SITE_NAME}. Free store pickup or delivery across Ghana within 48 hours.`,
    160
  );

  return pageMetadata({
    title: cleanTitle(p.seo_title) || p.name,
    description,
    path: `/product/${p.slug || slug}`,
    images: [p.metadata?.og_image, ...productImages(p)].filter((u, i, a): u is string => !!u && a.indexOf(u) === i),
    type: 'product',
    keywords: [p.name, category, p.brand, ...(p.tags || [])].filter(Boolean) as string[],
  });
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) {
    // Old address after a rename: send people (and Google) to the new one
    const moved = await renamedSlug(slug);
    if (moved) permanentRedirect(`/product/${moved}`);
    // Links by product id are still handled by the page itself
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    if (!isId && process.env.SUPABASE_SERVICE_ROLE_KEY) notFound();
  }

  let schemas: unknown[] = [];
  if (p) {
    const category = p.categories?.name;
    const categorySlug = p.categories?.slug;
    schemas = [
      productSchema({
        name: p.name,
        description: p.short_description || p.description || '',
        images: productImages(p),
        price: priceRange(p).low,
        highPrice: priceRange(p).high,
        compareAtPrice: p.compare_at_price,
        preorder: p.metadata?.availability === 'preorder',
        currency: 'GHS',
        sku: p.sku || undefined,
        inStock: isInStock(p),
        brand: p.brand || undefined,
        category,
        rating: p.rating_avg && p.rating_avg > 0 ? p.rating_avg : undefined,
        reviewCount: p.review_count && p.review_count > 0 ? p.review_count : undefined,
        url: `/product/${p.slug || slug}`,
      }),
      breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Shop', url: '/shop' },
        ...(category ? [{ name: category, url: `/shop?category=${categorySlug || ''}` }] : []),
        { name: p.name, url: `/product/${p.slug || slug}` },
      ]),
    ];
  }

  return (
    <>
      {schemas.length > 0 && <JsonLd data={schemas} />}
      <ProductDetailClient slug={slug} />
    </>
  );
}
