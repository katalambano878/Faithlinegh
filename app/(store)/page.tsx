import { unstable_cache } from 'next/cache';
import HomeClient from './HomeClient';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { stripPrivate } from '@/lib/db/rest-acl';

// Rendered per visit (never at build time, which has no database), with the
// product list cached for 60 seconds: new products show within a minute.
export const dynamic = 'force-dynamic';

const getHomeData = unstable_cache(loadHomeData, ['home-data-v1'], { revalidate: 60 });

async function loadHomeData() {
  try {
    const [products, categories] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('*, product_variants(*), product_images(*)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12),
      supabaseAdmin
        .from('categories')
        .select('id, name, slug, parent_id, position, metadata, image_url')
        .eq('status', 'active')
        .contains('metadata', { featured: true })
        .is('parent_id', null)
        .order('position', { ascending: true })
        .limit(4),
    ]);
    if (products.error || categories.error) return { products: null, categories: null };
    return { products: stripPrivate(products.data || []), categories: categories.data || [] };
  } catch {
    return { products: null, categories: null };
  }
}

export default async function Home() {
  const { products, categories } = await getHomeData();
  return <HomeClient initialProducts={products} initialCategories={categories} />;
}
