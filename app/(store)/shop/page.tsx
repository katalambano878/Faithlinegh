import { unstable_cache } from 'next/cache';
import ShopPage from './ShopClient';
import { shopCacheKey, type ShopInitial } from './shop-key';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { stripPrivate } from '@/lib/db/rest-acl';

// Rendered per visit (never at build time, which has no database). The
// queries below are cached for 60 seconds.
export const dynamic = 'force-dynamic';

const PER_PAGE = 9; // same as the shop's productsPerPage

const getCategories = unstable_cache(
  async () => {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, name, slug, image_url, parent_id, position, metadata')
      .eq('status', 'active')
      .order('position', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },
  ['shop-categories-v1'],
  { revalidate: 60 }
);

const getFirstPage = unstable_cache(
  async (categoryIds: string[] | null, search: string, sort: string) => {
    // Same query the shop runs in the browser (see ShopClient fetchProducts)
    let q = supabaseAdmin
      .from('products')
      .select(
        `*, categories!inner(name, slug), product_images!product_id(url, position), product_variants(id, name, price, quantity, option1, option2, image_url)`,
        { count: 'exact' }
      )
      .eq('status', 'active');
    // (product_images come back ordered by position already)
    if (search) q = q.ilike('name', `%${search}%`);
    if (categoryIds) q = q.in('category_id', categoryIds);
    if (sort === 'price-low') q = q.order('price', { ascending: true });
    else if (sort === 'price-high') q = q.order('price', { ascending: false });
    else if (sort === 'rating') q = q.order('rating_avg', { ascending: false });
    else q = q.order('created_at', { ascending: false });
    const { data, count, error } = await q.range(0, PER_PAGE - 1);
    if (error) throw new Error(error.message);
    return { data: stripPrivate(data || []), count: count || 0 };
  },
  ['shop-first-page-v1'],
  { revalidate: 60 }
);

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  const category = one(sp.category) || 'all';
  const sort = one(sp.sort) || 'popular';
  const search = one(sp.search);

  const initial: ShopInitial = { categories: null, products: null };
  try {
    const categories = await getCategories();
    initial.categories = categories;
    let ids: string[] | null = null;
    if (category !== 'all') {
      const cat = categories.find((c: any) => c.slug === category);
      ids = cat
        ? [cat.id, ...categories.filter((c: any) => c.parent_id === cat.id).map((c: any) => c.id)]
        : ['00000000-0000-0000-0000-000000000000'];
    }
    const first = await getFirstPage(ids, search, sort);
    initial.products = { key: shopCacheKey(category, search, sort), ...first };
  } catch (e: any) {
    // The page still works: the browser fetches what's missing.
    console.error('[shop] server prefetch failed:', e?.message);
  }

  return <ShopPage initial={initial} />;
}
