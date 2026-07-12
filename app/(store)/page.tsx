'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';
import ProductCard, {
  type ColorVariant,
  getColorHex,
} from '@/components/ProductCard';
import AnimatedSection, { AnimatedGrid } from '@/components/AnimatedSection';
import ArrivalsAccordion from '@/components/ArrivalsAccordion';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function Home() {
  usePageTitle('');
  const { getSetting } = useCMS();
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [featuredCategories, setFeaturedCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsResult, categoriesResult] = await Promise.all([
          supabase
            .from('products')
            .select('*, product_variants(*), product_images(*)')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(12),
          supabase
            .from('categories')
            .select('id, name, slug, parent_id, position, metadata, image_url')
            .eq('status', 'active')
            .contains('metadata', { featured: true })
            .is('parent_id', null)
            .order('position', { ascending: true })
            .limit(5),
        ]);

        if (productsResult.error) throw productsResult.error;
        setFeaturedProducts(productsResult.data || []);

        if (categoriesResult.error) throw categoriesResult.error;
        setFeaturedCategories(categoriesResult.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const heroPrimaryLink = getSetting('hero_primary_btn_link') || '/shop?sort=new';

  const popularProducts = featuredProducts.slice(0, 6);
  const latestProducts = featuredProducts;
  const fallbackCollections = [
    { name: 'Tops', slug: 'basics', image: '/category-basics.png' },
    { name: 'Dresses', slug: 'dresses', image: '/category-dresses.png' },
    { name: 'Bags', slug: 'bags', image: '/category-bags.png' },
    { name: 'Basics', slug: 'basics', image: '/category-basics.png' },
    { name: 'New In', slug: 'new-arrivals', image: '/hero-2.webp' },
  ];
  const collectionCategories = (featuredCategories.length > 0
    ? featuredCategories
    : fallbackCollections
  )
    .slice(0, 5)
    .map((category, index) => ({
      name: category.name,
      slug: category.slug,
      image:
        category.image_url ||
        category.metadata?.image ||
        fallbackCollections[index % fallbackCollections.length].image,
    }));

  const trustFeatures = [
    {
      icon: 'ri-truck-line',
      title: 'Free Shipping',
      body: 'On orders over GH₵800',
    },
    {
      icon: 'ri-timer-flash-line',
      title: 'Fast Delivery',
      body: 'Within 48 hours',
    },
    {
      icon: 'ri-arrow-go-back-line',
      title: 'Easy Returns',
      body: 'Hassle-free within 7 days',
    },
  ];

  return (
    <main className="flex-col items-center justify-between min-h-screen bg-white">
      {/* ── Hero: full-bleed lifestyle image with left-aligned serif copy ── */}
      <section className="relative w-full min-h-[100svh] flex items-center overflow-hidden bg-brand-brown">
        <div className="absolute inset-0">
          <Image
            src="/hero-1.webp"
            alt="Faithlinegh — everyday confidence, effortless style"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[72%_center] sm:object-[65%_center] lg:object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/15" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-24 sm:pt-28 pb-16">
          <div className="max-w-xl text-left">
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.38em] text-white/90">
              Everyday
            </p>
            <h1 className="mt-3 sm:mt-4 font-serif text-[3.25rem] sm:text-6xl lg:text-[4.5rem] font-normal leading-[0.95] tracking-tight text-white">
              Confidence
            </h1>
            <p className="mt-5 sm:mt-6 text-lg sm:text-xl lg:text-2xl font-light text-white">
              Effortless Style
            </p>
            <p className="mt-2 text-sm sm:text-base text-white/85 leading-relaxed max-w-md">
              Curated for every version of you
            </p>
            <Link
              href={heroPrimaryLink}
              className="mt-8 sm:mt-10 inline-flex items-center justify-center bg-white px-8 sm:px-10 py-3.5 sm:py-4 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-gray-900 transition-colors hover:bg-white/90"
            >
              Shop New In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust features bar ── */}
      <section className="border-b border-brand-brown/10 bg-brand-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-brand-brown/15">
            {trustFeatures.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col items-center justify-center gap-2 px-4 py-7 sm:py-9 text-center"
              >
                <i className={`${feature.icon} text-2xl text-brand-brown`} aria-hidden />
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-gray-900">
                  {feature.title}
                </p>
                <p className="text-xs sm:text-sm text-gray-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Collections: circular category row ── */}
      <AnimatedSection className="bg-[#E8DFD4] py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.32em] text-brand-brown">
            Shop Our Collections
          </p>
          <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-normal leading-tight text-gray-900">
            Elevated. Effortless. Faithline.
          </h2>
          <Link
            href="/categories"
            className="mt-6 sm:mt-8 inline-flex items-center justify-center border border-gray-900 px-8 sm:px-10 py-3 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-900 transition-colors hover:bg-brand-bag-dark hover:text-white"
          >
            Explore Collections
          </Link>

          <div className="mt-10 sm:mt-14 flex items-start justify-start sm:justify-center gap-6 sm:gap-8 lg:gap-12 overflow-x-auto pb-2 scrollbar-hide">
            {collectionCategories.map((item) => (
              <Link
                key={`${item.slug}-${item.name}`}
                href={`/shop?category=${encodeURIComponent(item.slug)}`}
                className="group flex w-[88px] sm:w-[108px] lg:w-[128px] shrink-0 flex-col items-center"
              >
                <div className="relative h-[88px] w-[88px] sm:h-[108px] sm:w-[108px] lg:h-[128px] lg:w-[128px] overflow-hidden rounded-full border-2 border-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-transform duration-500 group-hover:scale-105">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="mt-3 sm:mt-4 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-800">
                  {item.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-white py-7 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 md:items-end md:justify-between mb-5 sm:mb-8">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] text-brand-carton uppercase">
                Trending now
              </p>
              <h2 className="hidden sm:block mt-1 text-xl sm:text-2xl font-extrabold text-brand-brown tracking-tight">
                Products customers love most
              </h2>
            </div>
            <Link
              href="/shop?sort=bestsellers"
              aria-label="View bestselling products"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border-2 border-brand-brown/25 text-brand-brown hover:bg-brand-brown hover:text-white hover:border-brand-brown transition-all"
            >
              <i className="ri-arrow-right-line text-base" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 aspect-square rounded-2xl mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <AnimatedGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {popularProducts.map((product) => {
                const variants = product.product_variants || [];
                const hasVariants = variants.length > 0;
                const minVariantPrice = hasVariants
                  ? Math.min(
                      ...variants.map((v: any) => v.price || product.price)
                    )
                  : undefined;
                const totalVariantStock = hasVariants
                  ? variants.reduce(
                      (sum: number, v: any) => sum + (v.quantity || 0),
                      0
                    )
                  : 0;
                const effectiveStock = hasVariants
                  ? totalVariantStock
                  : product.quantity;

                const colorVariants: ColorVariant[] = [];
                const seenColors = new Set<string>();
                for (const v of variants) {
                  const colorName = (v as any).option2;
                  if (
                    colorName &&
                    !seenColors.has(colorName.toLowerCase().trim())
                  ) {
                    const hex = getColorHex(colorName);
                    if (hex) {
                      seenColors.add(colorName.toLowerCase().trim());
                      colorVariants.push({ name: colorName.trim(), hex });
                    }
                  }
                }

                return (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    price={product.price}
                    originalPrice={product.compare_at_price}
                    image={
                      product.product_images?.[0]?.url ||
                      'https://via.placeholder.com/400x500'
                    }
                    rating={product.rating_avg || 5}
                    reviewCount={product.review_count || 0}
                    badge={product.featured ? 'Featured' : 'Trending'}
                    inStock={effectiveStock > 0}
                    maxStock={effectiveStock || 50}
                    moq={product.moq || 1}
                    hasVariants={hasVariants}
                    minVariantPrice={minVariantPrice}
                    colorVariants={colorVariants}
                  />
                );
              })}
            </AnimatedGrid>
          )}
        </div>
      </AnimatedSection>

      <AnimatedSection className="hidden sm:block relative overflow-hidden bg-brand-cream py-6 sm:py-10">
        {/* decorative blush fields */}
        <div className="pointer-events-none absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-brand-blush/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-brand-sand/50 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 md:items-end mb-5 sm:mb-6">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.24em] text-brand-carton uppercase">
                <span className="h-px w-5 bg-gradient-to-r from-brand-gold to-brand-carton" />
                Just landed
              </span>
              <h2 className="mt-2 text-xl sm:text-2xl font-extrabold text-brand-brown tracking-tight leading-[1.1]">
                Fresh arrivals &amp; <span className="italic font-serif text-brand-carton">restocks</span>
              </h2>
            </div>
            <Link
              href="/shop"
              aria-label="View all"
              className="group shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border-2 border-brand-brown/25 text-brand-brown hover:bg-brand-brown hover:text-white hover:border-brand-brown transition-all"
            >
              <i className="ri-arrow-right-line text-base group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <ArrivalsAccordion
            items={(latestProducts.length ? latestProducts : popularProducts)
              .slice(0, 12)
              .map((product) => ({
                id: String(product.id),
                slug: product.slug,
                name: product.name,
                price: Number(product.price || 0),
                originalPrice: product.compare_at_price ?? product.original_price ?? null,
                image:
                  product.product_images?.[0]?.url ||
                  'https://via.placeholder.com/600x750',
              }))}
          />
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-white py-7 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-5 sm:mb-10">
              <p className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] text-brand-carton uppercase">
              Why customers stay with us
            </p>
            <h2 className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-extrabold text-gray-900">
              Curated for you
            </h2>
            <p className="mt-2 sm:mt-3 text-xs sm:text-base text-gray-600 leading-relaxed">
              At Faithlinegh, we believe style should be seamless. We hand-select each piece — from our
              structured bags to our clothings — to ensure you feel confident and put-together, every day.
              We don&apos;t just sell fashion; we help you build a wardrobe you love, delivered anywhere in Ghana.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-3">
            {[
              {
                icon: 'ri-shield-check-line',
                title: 'Quality assured',
                body: 'Every piece is carefully selected and checked before it reaches you.',
              },
              {
                icon: 'ri-customer-service-2-line',
                title: 'Friendly support',
                body: 'Helpful, personal service from order to delivery.',
              },
              {
                icon: 'ri-truck-line',
                title: 'Nationwide delivery',
                body: 'We deliver to your doorstep anywhere in Ghana.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="relative overflow-hidden rounded-2xl border border-brand-carton/10 bg-brand-cream/40 p-4 sm:p-6"
              >
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-carton/25 blur-2xl pointer-events-none" />
                <div className="relative">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-carton text-white shadow-md">
                    <i className={`${item.icon} text-xl`} />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <section className="pb-7 sm:pb-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#5B4436] via-[#5B4436] to-[#5B4436] text-white border border-[#5B4436]/30 shadow-[0_16px_45px_rgba(91,68,54,0.2)] flex flex-col md:flex-row md:items-stretch md:max-h-[280px]">
            <div className="relative w-full md:w-3/5 px-4 sm:px-7 py-3 sm:py-5 flex flex-col justify-center gap-1.5 sm:gap-2 text-center md:text-left">
              <span className="inline-flex items-center justify-center md:justify-start text-[9px] sm:text-[10px] font-semibold tracking-[0.22em] uppercase text-white/80">
                Shop with Faithlinegh
              </span>
              <h3 className="text-base sm:text-xl md:text-2xl font-extrabold leading-tight">
                Refined fashion delivered to your doorstep. Explore our curated collection.
              </h3>

              {/* Mobile: image between text and buttons */}
              <div className="relative w-full h-[150px] sm:h-[170px] shrink-0 overflow-hidden rounded-xl my-1.5 sm:my-2 md:hidden">
                <Image
                  src="/category-bags.png"
                  alt="Faithlinegh — quality fashion bags"
                  fill
                  className="object-cover object-center"
                  sizes="100vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-brown/25 to-transparent" />
              </div>

              <div className="pt-0.5 sm:pt-1 flex flex-wrap gap-2 justify-center md:justify-start">
                <Link
                  href="/shop"
                  className="inline-flex items-center rounded-full bg-white text-[#5B4436] px-5 sm:px-6 py-1.5 sm:py-2 text-[11px] sm:text-sm font-semibold shadow-lg hover:bg-[#F3F3F3] transition-colors"
                >
                  Start shopping
                  <i className="ri-arrow-right-up-line ml-1.5 sm:ml-2" />
                </Link>
                <Link
                  href="/account"
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 sm:px-5 py-1.5 sm:py-2 text-[11px] sm:text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  Create an account
                </Link>
              </div>
            </div>

            {/* Desktop: image on the right */}
            <div className="relative hidden md:block md:w-2/5 min-h-0 overflow-hidden md:rounded-r-2xl sm:md:rounded-r-3xl">
              <Image
                src="/category-bags.png"
                alt="Faithlinegh — quality fashion bags"
                fill
                className="object-cover object-center"
                sizes="40vw"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-brown/30 to-transparent" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
