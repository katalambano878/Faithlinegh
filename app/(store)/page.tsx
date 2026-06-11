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
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);

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
            .limit(4),
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

  const heroBackgrounds = [
    { src: '/hero-1.webp', position: 'object-[72%_center] sm:object-[65%_center] lg:object-right' },
    { src: '/hero-2.webp', position: 'object-center' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % heroBackgrounds.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [heroBackgrounds.length]);

  const heroHeadline =
    getSetting('hero_headline') || 'Quality, Affordable Bags, Basics & Dresses';
  const heroSubheadline =
    getSetting('hero_subheadline') ||
    'Shop stylish, everyday fashion at prices that make sense — with nationwide delivery across Ghana.';
  const heroPrimaryText = getSetting('hero_primary_btn_text') || 'Shop Now';
  const heroPrimaryLink = getSetting('hero_primary_btn_link') || '/shop';
  const heroSecondaryText =
    getSetting('hero_secondary_btn_text') || 'Browse Collections';
  const heroSecondaryLink = getSetting('hero_secondary_btn_link') || '/shop';

  const popularProducts = featuredProducts.slice(0, 6);
  const latestProducts = featuredProducts;
  const defaultCategoryStyles = [
    {
      chip: 'Everyday comfort',
      icon: 'ri-shirt-line',
      color: 'from-brand-carton to-brand-brown',
      image: '/category-basics.png',
    },
    {
      chip: 'Premium looks',
      icon: 'ri-vip-crown-line',
      color: 'from-[#A8826B] to-[#5A4234]',
      image: '/category-bags.png',
    },
    {
      chip: 'Event ready',
      icon: 'ri-t-shirt-air-line',
      color: 'from-brand-brown to-brand-gold',
      image: '/category-dresses.png',
    },
    {
      chip: 'Just landed',
      icon: 'ri-sparkling-line',
      color: 'from-[#5A4234]/70 to-[#5A4234]',
      image: '/hero-2.webp',
    },
  ];
  const fallbackCategories = [
    { name: 'Basic Tops', slug: 'basics', metadata: {} },
    { name: 'Bags', slug: 'bags', metadata: {} },
    { name: 'Dresses', slug: 'dresses', metadata: {} },
    { name: 'New Arrivals', slug: 'new-arrivals', metadata: {} },
  ];
  const vibeCategories = (featuredCategories.length > 0
    ? featuredCategories
    : fallbackCategories
  )
    .slice(0, 4)
    .map((category, index) => {
      const style = defaultCategoryStyles[index % defaultCategoryStyles.length];
      return {
        ...category,
        chip: category.metadata?.chip || style.chip,
        icon: category.metadata?.icon || style.icon,
        color: category.metadata?.color || style.color,
        image: category.image_url || category.metadata?.image || style.image || null,
      };
    });

  return (
    <main className="flex-col items-center justify-between min-h-screen bg-white">
      <section className="relative w-full min-h-[82vh] sm:min-h-[85vh] flex items-center justify-center overflow-hidden bg-brand-brown">
        {/* Full-bleed background slider */}
        <div className="absolute inset-0">
          {heroBackgrounds.map((bg, index) => (
            <Image
              key={bg.src}
              src={bg.src}
              alt="Faithlinegh — quality, affordable women's fashion in Ghana"
              fill
              priority={index === 0}
              sizes="100vw"
              className={`object-cover transition-opacity duration-[1400ms] ease-in-out ${bg.position} ${
                index === currentHeroSlide ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
          {/* Soft readability overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-brand-brown/55 via-brand-brown/35 to-brand-brown/65" />
        </div>

        <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.24em] text-white ring-1 ring-white/25">
            <i className="ri-sparkling-2-fill text-brand-gold" />
            Faithlinegh · Quality Fashion
          </span>

          <h1 className="mt-3 sm:mt-5 text-xl sm:text-3xl lg:text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-md">
            {heroHeadline.includes('Bags') ? (
              <>
                Quality, Affordable{' '}
                <span className="italic font-serif text-brand-gold">Bags, Basics</span> &amp; Dresses
              </>
            ) : (
              heroHeadline
            )}
          </h1>

          <p className="hidden sm:block mt-2.5 sm:mt-4 text-xs sm:text-base text-white/90 max-w-lg mx-auto leading-relaxed drop-shadow">
            {heroSubheadline}
          </p>

          <div className="mt-5 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4">
            <Link
              href={heroPrimaryLink}
              className="group w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-white px-6 sm:px-8 py-2.5 sm:py-3.5 text-xs sm:text-base font-bold text-brand-brown shadow-xl shadow-black/20 transition-all duration-300 hover:bg-gradient-to-r hover:from-brand-gold hover:to-brand-carton hover:text-white"
            >
              {heroPrimaryText}
              <i className="ri-arrow-right-up-line ml-2 text-sm sm:text-base transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href={heroSecondaryLink}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-white/50 bg-white/5 backdrop-blur-sm px-6 sm:px-8 py-2.5 sm:py-3.5 text-xs sm:text-base font-semibold text-white transition-all duration-300 hover:bg-white hover:text-brand-brown"
            >
              {heroSecondaryText}
            </Link>
          </div>

          {/* Slider dots */}
          <div className="mt-5 sm:mt-9 flex items-center justify-center gap-2">
            {heroBackgrounds.map((bg, index) => (
              <button
                key={`hbg-${bg.src}`}
                onClick={() => setCurrentHeroSlide(index)}
                aria-label={`Show slide ${index + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentHeroSlide ? 'w-7 bg-brand-gold' : 'w-2 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <AnimatedSection className="relative bg-white py-6 sm:py-11 border-b border-brand-carton/10 overflow-hidden">
        <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-brand-blush/25 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6 md:items-end">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2.5 text-[10px] sm:text-[11px] font-bold tracking-[0.28em] text-brand-carton uppercase">
                <span className="h-px w-7 bg-gradient-to-r from-brand-gold to-brand-carton" />
                Shop by category
              </span>
              <h2 className="hidden sm:block mt-1.5 sm:mt-2 text-xl sm:text-3xl font-extrabold text-brand-brown tracking-tight leading-[1.1]">
                Find your <span className="italic font-serif text-brand-carton">signature</span> look
              </h2>
            </div>
            <Link
              href="/shop"
              aria-label="Browse full catalogue"
              className="group shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border-2 border-brand-brown/25 text-brand-brown hover:bg-brand-brown hover:text-white hover:border-brand-brown transition-all"
            >
              <i className="ri-arrow-right-line text-base group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {vibeCategories.map((item) => (
              <Link
                key={item.slug}
                href={`/shop?category=${encodeURIComponent(item.slug)}`}
                className="group relative block aspect-[5/3] sm:aspect-[16/11] overflow-hidden rounded-xl sm:rounded-2xl border border-brand-carton/15 shadow-[0_2px_14px_-10px_rgba(61,43,33,0.3)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_22px_42px_-24px_rgba(61,43,33,0.55)]"
              >
                {/* Backdrop: image when available, else brand gradient */}
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-110"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color}`} />
                )}

                {/* Readability overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-brown/85 via-brand-brown/25 to-transparent" />

                {/* Watermark icon */}
                <i className={`${item.icon} pointer-events-none absolute -right-2 -top-2 text-6xl text-white/10 transition-all duration-500 group-hover:text-white/20 group-hover:rotate-6`} />

                {/* Content */}
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-2 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/20">
                    <i className="ri-sparkling-2-fill text-brand-gold text-[9px]" />
                    {item.chip}
                  </span>
                  <p className="mt-1.5 text-sm sm:text-base font-bold leading-tight text-white drop-shadow-sm line-clamp-1">
                    {item.name}
                  </p>
                  <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-white/0 -translate-y-1 transition-all duration-300 group-hover:text-white/90 group-hover:translate-y-0">
                    Shop now <i className="ri-arrow-right-line" />
                  </span>
                </div>

                {/* Champagne hover frame */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-brand-gold/0 transition-all duration-500 group-hover:ring-brand-gold/40" />
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
              Your go-to fashion store
            </h2>
            <p className="mt-2 sm:mt-3 text-xs sm:text-base text-gray-600">
              From basic tops and dresses to quality fashion bags — we make it easy to shop
              stylish, affordable pieces and have them delivered anywhere in Ghana.
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
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#A8826B] via-[#8A7750] to-[#5A4234] text-white border border-[#A8826B]/30 shadow-[0_16px_45px_rgba(171,148,98,0.2)] flex flex-col md:flex-row md:items-stretch md:max-h-[280px]">
            <div className="relative w-full md:w-3/5 px-4 sm:px-7 py-3 sm:py-5 flex flex-col justify-center gap-1.5 sm:gap-2 text-center md:text-left">
              <span className="inline-flex items-center justify-center md:justify-start text-[9px] sm:text-[10px] font-semibold tracking-[0.22em] uppercase text-white/80">
                Shop with Faithlinegh
              </span>
              <h3 className="text-base sm:text-xl md:text-2xl font-extrabold leading-tight">
                Quality style, without breaking the bank.
              </h3>
              <p className="text-[11px] sm:text-sm text-white/75 max-w-md mx-auto md:mx-0 leading-snug line-clamp-2 sm:line-clamp-none">
                Discover bags, basics and dresses you&apos;ll love — ordered online and
                delivered to your doorstep anywhere in Ghana.
              </p>

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
                  className="inline-flex items-center rounded-full bg-white text-[#5A4234] px-5 sm:px-6 py-1.5 sm:py-2 text-[11px] sm:text-sm font-semibold shadow-lg hover:bg-[#F3F3F3] transition-colors"
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
