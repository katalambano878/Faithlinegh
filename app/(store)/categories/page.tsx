import type { Metadata } from 'next';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PageHero from '@/components/PageHero';
import JsonLd from '@/components/JsonLd';
import {
  pageMetadata,
  collectionPageSchema,
  itemListSchema,
  breadcrumbSchema,
  SITE_NAME,
} from '@/lib/seo';

export const revalidate = 0; // Ensure fresh data on every visit

export const metadata: Metadata = pageMetadata({
  title: 'Shop by Category — Bags, Basics & Dresses',
  description: `Browse ${SITE_NAME}'s collections of quality, affordable bags, basic tops and dresses for women. Shop by category with fast nationwide delivery across Ghana.`,
  path: '/categories',
  keywords: ['shop bags Ghana', 'shop dresses Ghana', 'fashion categories Ghana'],
});

export default async function CategoriesPage() {
  const { data: categoriesData } = await supabase
    .from('categories')
    .select(`
      id,
      name,
      slug,
      description,
      image_url,
      position
    `)
    .eq('status', 'active')
    .order('position', { ascending: true });

  const palette = [
    { chip: 'Everyday', icon: 'ri-shirt-line', fallback: '/category-basics.png' },
    { chip: 'Essentials', icon: 'ri-shopping-bag-3-line', fallback: '/category-bags.png' },
    { chip: 'Statement', icon: 'ri-t-shirt-air-line', fallback: '/category-dresses.png' },
    { chip: 'New in', icon: 'ri-sparkling-line', fallback: '/hero-2.webp' },
    { chip: 'Curated', icon: 'ri-vip-crown-line', fallback: '/hero-1.webp' },
    { chip: 'Featured', icon: 'ri-star-smile-line', fallback: '/wishlist.jpeg' },
  ];

  const categories = categoriesData?.map((c, i) => {
    const style = palette[i % palette.length];
    return {
      ...c,
      image: c.image_url || style.fallback,
      chip: style.chip,
      icon: style.icon,
    };
  }) || [];

  const categorySchemas = [
    collectionPageSchema({
      name: 'Shop by Category',
      description: `Browse ${SITE_NAME}'s collections of bags, basics and dresses.`,
      url: '/categories',
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Categories', url: '/categories' },
    ]),
    ...(categories.length > 0
      ? [
          itemListSchema(
            categories.map((c) => ({ name: c.name, url: `/shop?category=${c.slug}` })),
            'Product Categories'
          ),
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={categorySchemas} />
      <PageHero
        title="Shop by Category"
        subtitle="Explore our curated collections and find exactly what you're looking for"
        image="/hero-2.webp"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="pointer-events-none absolute -top-10 right-0 h-48 w-48 rounded-full bg-brand-blush/30 blur-3xl" />

        {categories.length > 0 ? (
          <>
            <div className="mb-4 sm:mb-5 flex items-end justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-carton">
                  <span className="h-px w-5 bg-gradient-to-r from-brand-gold to-brand-carton" />
                  Collections
                </span>
                <p className="mt-1 text-xs text-brand-brown/65">
                  Tap a category to start shopping
                </p>
              </div>
              <Link
                href="/shop"
                className="hidden sm:inline-flex items-center gap-1 rounded-full border border-brand-carton/30 px-3 py-1.5 text-[10px] font-semibold text-brand-brown hover:bg-brand-brown hover:text-white transition-colors"
              >
                View all products <i className="ri-arrow-right-line text-xs" />
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/shop?category=${category.slug}`}
                  className="group relative block aspect-[16/11] overflow-hidden rounded-xl bg-brand-cream shadow-[0_2px_12px_-8px_rgba(61,43,33,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(61,43,33,0.5)]"
                >
                  <img
                    src={category.image}
                    alt={category.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-brown/88 via-brand-brown/20 to-transparent" />

                  <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-white/90 backdrop-blur-sm px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-brand-brown shadow-sm">
                    <i className={`${category.icon} text-brand-gold text-[7px]`} />
                    {category.chip}
                  </span>

                  <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                    <h3 className="text-xs sm:text-sm font-bold leading-tight text-white line-clamp-1 drop-shadow-sm">
                      {category.name}
                    </h3>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-[9px] font-medium text-white/70 line-clamp-1">
                        Shop now
                      </span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-brown shadow-sm transition-all duration-300 group-hover:scale-110">
                        <i className="ri-arrow-right-line text-[10px]" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-xl">
            <i className="ri-inbox-line text-5xl text-gray-300 mb-4"></i>
            <p className="text-xl text-gray-500">No categories found.</p>
          </div>
        )}
      </div>

      <div className="bg-white px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 pt-2">
        <div className="max-w-4xl mx-auto rounded-2xl bg-gradient-to-br from-brand-brown to-[#47362C] px-6 sm:px-10 py-8 sm:py-10 text-center shadow-[0_12px_40px_-18px_rgba(61,43,33,0.45)]">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
            Can&apos;t Find What You&apos;re Looking For?
          </h2>
          <p className="text-sm sm:text-base text-white/80 mb-6 max-w-lg mx-auto leading-relaxed">
            Try our advanced search or contact our team for personalised product recommendations
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-white text-brand-brown px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-brand-cream transition-colors whitespace-nowrap"
            >
              <i className="ri-search-line"></i>
              Search All Products
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-brand-carton text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-brand-tan transition-colors whitespace-nowrap"
            >
              <i className="ri-customer-service-line"></i>
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
