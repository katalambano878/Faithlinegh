'use client';

import Link from 'next/link';
import Image from 'next/image';
import { localImagePath } from '@/lib/img';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import SizeGuideModal from '@/components/SizeGuideModal';
import BodyPortal from '@/components/BodyPortal';
import { notFound } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { parseBundleTiers, computeBundlePrice, tierUnitPrice, tierSavings, BundleTier } from '@/lib/bundle-pricing';

// Map common color names to hex values for the swatch preview
function colorNameToHex(name: string): string {
  const map: Record<string, string> = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    orange: '#f97316', purple: '#a855f7', pink: '#ec4899', black: '#111827',
    white: '#ffffff', gray: '#6b7280', grey: '#6b7280', brown: '#92400e',
    navy: '#1e3a5f', gold: '#d4a017', silver: '#c0c0c0', beige: '#f5f5dc',
    maroon: '#800000', teal: '#14b8a6', coral: '#ff7f50', ivory: '#fffff0',
    cream: '#fffdd0', burgundy: '#800020', lavender: '#e6e6fa', cyan: '#06b6d4',
    magenta: '#d946ef', olive: '#84cc16', peach: '#ffcba4', mint: '#98f5e1',
    rose: '#f43f5e', wine: '#722f37', charcoal: '#374151', sky: '#0ea5e9',
  };
  return map[name.toLowerCase().trim()] || '#d1d5db';
}

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<any>(null);
  usePageTitle(product?.name || 'Product');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [manualImage, setManualImage] = useState(false);
  const [nudge, setNudge] = useState(false);
  const choiceRef = useRef<HTMLDivElement>(null);

  // Detect which size guide fits this product from its variant size names
  const detectSizeGuideCategory = (sizes: string[]): string | null => {
    if (!sizes.length) return null;
    const lower = sizes.map(s => (s || '').toLowerCase().trim());
    const letterSizes = ['xxs', 'xs', 's', 'm', 'l', 'xl', '2xl', 'xxl', '3xl', '4xl', '5xl'];
    if (lower.some(s => /^uk\s?\d{1,2}(\.5)?$/.test(s))) return 'Shoes';
    if (lower.some(s => /^(3[5-9]|4[0-6])$/.test(s))) return 'Shoes';
    if (lower.some(s => /^(2[6-9]|3[0-9]|4[0-4])$/.test(s)) && !lower.some(s => letterSizes.includes(s))) return 'Bottoms';
    if (lower.some(s => letterSizes.includes(s))) return 'Tops & Shirts';
    return null;
  };

  const { addToCart } = useCart();

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        // Fetch via storefront API (service role) so variants always load regardless of RLS
        let dataToTransform: any = null;
        const res = await fetch(`/api/storefront/products/${encodeURIComponent(slug)}`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          dataToTransform = await res.json();
        }
        if (!dataToTransform) {
          // Fallback: client Supabase (e.g. if API not available)
          const { data: fallbackData, error } = await cachedQuery<{ data: any; error: any }>(
            `product:${slug}`,
            async () => {
              let query = supabase
                .from('products')
                .select(`
                  *,
                  categories(name),
                  product_variants(*),
                  product_images(url, position, alt_text, media_type)
                `);
              const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
              if (isUUID) query = query.or(`id.eq.${slug},slug.eq.${slug}`);
              else query = query.eq('slug', slug);
              return query.single() as any;
            },
            2 * 60 * 1000
          );
          if (error || !fallbackData) {
            console.error('Error fetching product:', error);
            setLoading(false);
            return;
          }
          dataToTransform = fallbackData;
        }

        // Transform product data
        // Map variant colors from option2, and extract color_hex from metadata
        const rawVariants = (dataToTransform.product_variants || []).map((v: any) => ({
          ...v,
          color: v.option2 || '',
          colorHex: v.metadata?.color_hex || ''
        }));

        // Build a color-to-hex map from variants (prefer stored hex, fallback to colorNameToHex)
        const colorHexMap: Record<string, string> = {};
        rawVariants.forEach((v: any) => {
          if (v.color) {
            if (!colorHexMap[v.color]) {
              colorHexMap[v.color] = v.colorHex || colorNameToHex(v.color);
            }
          }
        });

        const transformedProduct = {
          ...dataToTransform,
          media: dataToTransform.product_images?.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)).map((img: any) => ({
            url: img.url,
            type: img.media_type || (/\.(mp4|mov|webm)$/i.test(img.url) ? 'video' : 'image'),
          })) || [],
          images: dataToTransform.product_images?.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)).map((img: any) => img.url) || [],
          category: dataToTransform.categories?.name || 'Shop',
          rating: dataToTransform.rating_avg || 0,
          reviewCount: 0,
          stockCount: dataToTransform.quantity,
          moq: dataToTransform.moq || 1,
          colors: [...new Set(rawVariants.map((v: any) => v.color).filter(Boolean))],
          colorHexMap,
          variants: rawVariants,
          sizes: rawVariants.map((v: any) => v.name) || [],
          features: ['Premium Quality', 'Authentic Design'],
          featured: ['Premium Quality', 'Authentic Design'],
          care: 'Handle with care.',
          preorderShipping: dataToTransform.metadata?.preorder_shipping || null,
          isPreorder: dataToTransform.metadata?.availability === 'preorder',
          bundlePricing: parseBundleTiers(dataToTransform.metadata?.bundle_pricing)
        };

        // Ensure at least one image/placeholder
        if (transformedProduct.images.length === 0) {
          transformedProduct.images = ['https://via.placeholder.com/800x800?text=No+Image'];
        }

        setProduct(transformedProduct);

        // Set initial quantity to MOQ
        if (transformedProduct.moq > 1) {
          setQuantity(transformedProduct.moq);
        }

        // Pre-select the first colour that is in stock (its photo leads the gallery);
        // the size is never pre-selected, so the shopper always confirms it.
        setSelectedVariant(null);
        setSelectedSize('');
        setManualImage(false);
        setNudge(false);
        const vStock = (v: any) => v.stock ?? v.quantity ?? 0;
        const perVariantStock = transformedProduct.variants.some((v: any) => vStock(v) > 0);
        const firstInStockColor = (transformedProduct.colors as string[]).find((color) =>
          transformedProduct.isPreorder || transformedProduct.variants.some((v: any) => v.color === color && (perVariantStock ? vStock(v) > 0 : (transformedProduct.stockCount ?? 0) > 0))
        );
        const initialColor = firstInStockColor || '';
        setSelectedColor(initialColor);
        if (initialColor) {
          const only = transformedProduct.variants.filter((v: any) => v.color === initialColor);
          if (only.length === 1) {
            setSelectedVariant(only[0]);
            setSelectedSize(only[0].name);
          }
        }

        // Fetch related products (cached for 5 minutes)
        if (dataToTransform.category_id) {
          const { data: related } = await cachedQuery<{ data: any; error: any }>(
            `related:${dataToTransform.category_id}:${dataToTransform.id}`,
            (() => supabase
              .from('products')
              .select('*, product_images(url, position), product_variants(id, name, price, quantity)')
              .eq('category_id', dataToTransform.category_id)
              .neq('id', dataToTransform.id)
              .limit(4)) as any,
            5 * 60 * 1000
          );

          if (related) {
            setRelatedProducts(related.map((p: any) => {
              const variants = p.product_variants || [];
              const hasVariants = variants.length > 0;
              const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
              const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
              const effectiveStock = hasVariants ? totalVariantStock : p.quantity;
              const relatedTiers = parseBundleTiers(p.metadata?.bundle_pricing);
              return {
                bundlePricing: relatedTiers.length > 0 ? relatedTiers : null,
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                image: p.product_images?.[0]?.url || 'https://via.placeholder.com/800?text=No+Image',
                rating: p.rating_avg || 0,
                reviewCount: 0,
                inStock: effectiveStock > 0,
                maxStock: effectiveStock || 50,
                moq: p.moq || 1,
                hasVariants,
                minVariantPrice
              };
            }));
          }
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const hasVariants = product?.variants?.length > 0;
  const hasColors = product?.colors?.length > 0;
  const needsVariantSelection = hasVariants && !selectedVariant;
  const needsColorSelection = hasColors && !selectedColor;

  // Determine the active price: variant price if selected, otherwise base price
  // A variant saved without its own price (0/blank) sells at the product price
  const activePrice = Number(selectedVariant?.price) > 0 ? Number(selectedVariant.price) : (product?.price ?? 0);
  // Pre-order products can be ordered whatever the stock says
  const activeStock = product?.isPreorder ? 99 : selectedVariant ? (selectedVariant.stock ?? selectedVariant.quantity ?? product?.stockCount ?? 0) : (product?.stockCount ?? 0);

  // Bundle pricing (e.g. 1 for ₵90, 3 for ₵255, 5 for ₵410)
  const bundleTiers: BundleTier[] = product?.bundlePricing || [];
  const hasBundles = bundleTiers.length > 1 || (bundleTiers.length === 1 && bundleTiers[0].qty > 1);
  const bundleTotal = hasBundles ? computeBundlePrice(quantity, activePrice, bundleTiers) : activePrice * quantity;
  const bundleSaved = hasBundles ? Math.max(0, activePrice * quantity - bundleTotal) : 0;

  const handleAddToCart = () => {
    if (!product) return;
    if (needsVariantSelection) return; // Safety check

    // Build variant display string: "Color / Name" or just "Name" or just "Color"
    let variantLabel: string | undefined;
    if (selectedVariant) {
      const color = selectedVariant.color || selectedColor || '';
      const name = selectedVariant.name || '';
      if (color && name) {
        variantLabel = `${color} / ${name}`;
      } else {
        variantLabel = color || name || undefined;
      }
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: activePrice,
      image: selectedVariant?.image_url || product.images[0],
      quantity: quantity,
      variant: variantLabel,
      variantId: selectedVariant?.id ?? null,
      slug: product.slug,
      maxStock: activeStock,
      moq: product.moq || 1,
      bundlePricing: hasBundles ? bundleTiers : null
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    window.location.href = '/checkout';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-12 flex justify-center items-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-brand-brown animate-spin mb-4 block"></i>
          <p className="text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white py-20 flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-brand-brown mb-4">Product Not Found</h2>
          <Link href="/shop" className="text-brand-brown hover:underline">Return to Shop</Link>
        </div>
      </div>
    );
  }

  const discount = product.compare_at_price ? Math.round((1 - activePrice / product.compare_at_price) * 100) : 0;
  const minVariantPrice = hasVariants ? Math.min(...product.variants.map((v: any) => v.price || product.price)) : product.price;
  const maxVariantPrice = hasVariants ? Math.max(...product.variants.map((v: any) => v.price || product.price)) : product.price;
  const priceVaries = hasVariants && !selectedVariant && minVariantPrice !== maxVariantPrice;

  const variantStock = (v: any) => v.stock ?? v.quantity ?? 0;
  // When any variant carries stock, stock is tracked per variant and a 0 means sold out.
  // Otherwise (legacy products) only the product-level stock counts.
  const variantsTrackStock = (product.variants || []).some((v: any) => variantStock(v) > 0);
  const isVariantOut = (v: any) => !product.isPreorder && (variantsTrackStock ? variantStock(v) === 0 : (product.stockCount ?? 0) === 0);
  const colorVariants = (color: string) => product.variants.filter((v: any) => v.color === color);
  const isColorOut = (color: string) => colorVariants(color).every(isVariantOut);
  const colorImage = (color: string) => colorVariants(color).find((v: any) => v.image_url)?.image_url as string | undefined;

  const visibleVariants: any[] = hasColors
    ? (selectedColor ? colorVariants(selectedColor) : [])
    : (product.variants || []);
  const showSizeSelector = hasColors ? visibleVariants.length > 1 : visibleVariants.length > 0;
  const guideCategory = detectSizeGuideCategory(visibleVariants.map((v: any) => v.name || ''));

  const ready = !needsColorSelection && !needsVariantSelection && activeStock > 0;
  const soldOut = !needsColorSelection && !needsVariantSelection && activeStock === 0;
  const lowStock = selectedVariant && activeStock > 0 && activeStock <= 5;
  const minQty = product.moq || 1;

  // Quantity choices: single (or MOQ) plus each bundle tier, priced by the real bundle engine
  const quantityChoices: { qty: number; total: number; saved: number }[] = hasBundles
    ? Array.from(new Set([minQty, ...bundleTiers.map(t => t.qty).filter(q => q > minQty)]))
      .slice(0, 3)
      .map(q => {
        const total = computeBundlePrice(q, activePrice, bundleTiers);
        return { qty: q, total, saved: Math.max(0, activePrice * q - total) };
      })
    : [];

  const money = (n: number) => `₵${n.toFixed(2)}`;
  // A thumbnail the shopper tapped wins; otherwise show the chosen variant / colour photo
  const choiceImage: string | undefined = manualImage
    ? undefined
    : (selectedVariant?.image_url || (selectedColor ? colorImage(selectedColor) : undefined));
  const mainImageSrc: string = choiceImage || product.images[selectedImage];
  const mainIsVideo = !choiceImage && product.media?.[selectedImage]?.type === 'video';

  const pickColor = (color: string) => {
    setSelectedColor(color);
    setManualImage(false);
    setNudge(false);
    const matching = colorVariants(color);
    if (matching.length === 1) {
      setSelectedVariant(matching[0]);
      setSelectedSize(matching[0].name);
    } else {
      // Keep the chosen size if this colour has it in stock
      const sameSize = matching.find((v: any) => v.name === selectedSize && !isVariantOut(v));
      setSelectedVariant(sameSize || null);
      if (!sameSize) setSelectedSize('');
    }
  };

  const pickVariant = (variant: any) => {
    setSelectedVariant(variant);
    setSelectedSize(variant.name);
    const stockForVariant = variantStock(variant);
    if (variantsTrackStock && stockForVariant > 0) setQuantity(q => Math.min(q, Math.max(stockForVariant, product.moq || 1)));
    setManualImage(false);
    setNudge(false);
  };

  const tryAddToCart = (buyNow: boolean) => {
    if (!ready) {
      if (!soldOut) {
        setNudge(true);
        choiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (buyNow) handleBuyNow();
    else handleAddToCart();
  };

  const nudgeMessage = needsColorSelection ? 'Choose a colour to continue.' : 'Choose your size to add this to your bag.';
  const ctaLabel = soldOut ? 'Out of stock' : product.isPreorder ? 'Pre-order' : 'Add to bag';

  return (
    <>
      {/* Product & breadcrumb JSON-LD are rendered server-side in page.tsx for reliable indexing. */}
      <main className="min-h-screen bg-white text-[#2B211B] pb-28 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] text-[#6E6158] py-5 flex-wrap">
            <Link href="/shop" className="hover:text-[#2B211B] transition-colors">Shop</Link>
            <span aria-hidden="true">/</span>
            <span>{product.category}</span>
            <span aria-hidden="true">/</span>
            <span className="text-[#2B211B] truncate max-w-[220px]">{product.name}</span>
          </nav>

          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-8 lg:gap-16 items-start">
            {/* ── Gallery ── */}
            <section aria-label="Photos" className="min-w-0 flex flex-col-reverse lg:flex-row gap-3 lg:gap-4 lg:sticky lg:top-24">
              {product.images.length > 1 && (
                <div className="flex lg:flex-col gap-2.5 lg:gap-3 overflow-x-auto lg:overflow-visible scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:w-[76px] shrink-0">
                  {product.images.map((image: string, index: number) => {
                    const isVideo = product.media?.[index]?.type === 'video';
                    const active = mainImageSrc === image;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => { setSelectedImage(index); setManualImage(true); }}
                        aria-label={`View photo ${index + 1}`}
                        aria-current={active ? 'true' : undefined}
                        className={`relative w-[64px] h-[64px] lg:w-[76px] lg:h-[76px] shrink-0 rounded-[10px] overflow-hidden bg-white transition-[border-color] cursor-pointer ${active ? 'border-[1.5px] border-[#5B4436]' : 'border border-[#E4DDD3] hover:border-[#C9BEB1]'}`}
                      >
                        {isVideo ? (
                          <>
                            <video src={image} className="w-full h-full object-cover" muted preload="none" />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/20"><i className="ri-play-fill text-white text-lg"></i></span>
                          </>
                        ) : (
                          <Image src={localImagePath(image)} alt="" fill className="object-contain p-1" sizes="80px" quality={60} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="relative flex-1 min-w-0 aspect-square lg:max-w-[560px] overflow-hidden bg-white sm:border sm:border-[#EFEAE3] -mx-4 sm:mx-0 sm:rounded-2xl lg:rounded-[20px]">
                {mainIsVideo ? (
                  <video key={mainImageSrc} src={mainImageSrc} className="w-full h-full object-contain" controls muted loop playsInline preload="none" />
                ) : mainImageSrc ? (
                  <Image
                    key={mainImageSrc}
                    src={localImagePath(mainImageSrc)}
                    alt={selectedColor ? `${product.name} in ${selectedColor}` : product.name}
                    fill
                    className="object-contain p-3 sm:p-5 lg:p-6 animate-[fadeIn_200ms_ease-out]"
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    priority
                    quality={80}
                  />
                ) : null}
                {discount > 0 && (
                  <span className="absolute top-4 left-4 bg-[#5B4436] text-white text-xs font-semibold px-3 py-1.5 rounded-full">Save {discount}%</span>
                )}
                <button
                  type="button"
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  aria-pressed={isWishlisted}
                  className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-[0_2px_8px_rgba(43,33,27,0.08)] cursor-pointer"
                >
                  <i className={`${isWishlisted ? 'ri-heart-fill text-[#5B4436]' : 'ri-heart-line text-[#2B211B]'} text-xl`}></i>
                </button>
              </div>
            </section>

            {/* ── Choose and buy ── */}
            <section aria-label="Choose and buy" className="flex flex-col gap-7 min-w-0">
              <div className="flex flex-col gap-2.5">
                <h1 className="font-serif font-medium text-[30px] lg:text-[40px] leading-[1.1] tracking-[-0.01em] text-balance">{product.name}</h1>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-xl lg:text-2xl font-semibold tabular-nums">
                    {priceVaries ? `From ${money(minVariantPrice)}` : money(activePrice)}
                  </span>
                  {product.compare_at_price && product.compare_at_price > activePrice && (
                    <span className="text-base text-[#6E6158] line-through tabular-nums">{money(product.compare_at_price)}</span>
                  )}
                  {hasBundles && bundleTiers.length > 0 && (() => {
                    const best = bundleTiers[bundleTiers.length - 1];
                    const each = tierUnitPrice(best);
                    return each < activePrice ? (
                      <span className="text-[13px] text-[#6E6158]">From {money(each)} each when you buy {best.qty}</span>
                    ) : null;
                  })()}
                </div>
                {product.description && (
                  <p className="text-[15px] leading-relaxed text-[#4E423A] max-w-[60ch] line-clamp-3">{product.description}</p>
                )}
              </div>

              <div ref={choiceRef} className="flex flex-col gap-7 scroll-mt-28">
                {/* Colour */}
                {hasColors && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-semibold">
                        Colour{selectedColor && <>: <span className="font-medium text-[#4E423A]">{selectedColor}</span></>}
                      </span>
                      {product.colors.length > 1 && <span className="text-[13px] text-[#6E6158]">{product.colors.length} colours</span>}
                    </div>
                    <div role="group" aria-label="Colour" className={`flex flex-wrap gap-3 rounded-xl ${nudge && needsColorSelection ? 'ring-2 ring-[#A3392B] ring-offset-4' : ''}`}>
                      {product.colors.map((color: string) => {
                        const selected = selectedColor === color;
                        const out = isColorOut(color);
                        const img = colorImage(color);
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => pickColor(color)}
                            aria-label={`${color}${out ? ', sold out' : ''}`}
                            aria-pressed={selected}
                            title={color}
                            className={`relative w-10 h-10 lg:w-9 lg:h-9 rounded-full overflow-hidden border border-[#2B211B]/15 transition-shadow cursor-pointer ${selected ? 'shadow-[0_0_0_2px_#fff,0_0_0_3.5px_#5B4436]' : 'hover:shadow-[0_0_0_2px_#fff,0_0_0_3.5px_#D8CFC3]'} ${out ? 'opacity-50' : ''}`}
                            style={img ? undefined : { backgroundColor: product.colorHexMap?.[color] || colorNameToHex(color) }}
                          >
                            {img && <Image src={localImagePath(img)} alt="" fill className="object-cover scale-[2.2]" sizes="40px" quality={50} />}
                            {out && <span aria-hidden="true" className="absolute left-1/2 -top-1 w-[1.5px] h-12 bg-[#2B211B] -translate-x-1/2 rotate-45"></span>}
                          </button>
                        );
                      })}
                    </div>
                    {selectedColor && isColorOut(selectedColor) && (
                      <p className="text-[13px] text-[#A3392B]">{selectedColor} is sold out. Choose another colour.</p>
                    )}
                  </div>
                )}

                {/* Size / type */}
                {showSizeSelector && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-semibold">
                        Size{selectedVariant && <>: <span className="font-medium text-[#4E423A]">{selectedVariant.name}</span></>}
                      </span>
                      {guideCategory && (
                        <button type="button" onClick={() => setSizeGuideOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] text-[#5B4436] underline underline-offset-[3px] cursor-pointer">
                          <i className="ri-ruler-line"></i> Size guide
                        </button>
                      )}
                    </div>
                    <div role="group" aria-label="Size" className={`grid grid-cols-4 gap-2 lg:gap-2.5 rounded-xl ${nudge && !needsColorSelection && needsVariantSelection ? 'ring-2 ring-[#A3392B] ring-offset-4' : ''}`}>
                      {visibleVariants.map((variant: any) => {
                        const selected = selectedVariant?.id === variant.id;
                        const out = isVariantOut(variant);
                        const showPrice = (variant.price || product.price) !== (hasColors ? activePrice : product.price);
                        return (
                          <button
                            key={variant.id || variant.name}
                            type="button"
                            onClick={() => pickVariant(variant)}
                            disabled={out}
                            aria-pressed={selected}
                            aria-label={`Size ${variant.name}${showPrice ? `, ${money(variant.price || product.price)}` : ''}${out ? ', sold out' : ''}`}
                            className={`min-h-[50px] px-2 py-1.5 rounded-xl text-[15px] font-semibold transition-colors flex flex-col items-center justify-center leading-tight cursor-pointer disabled:cursor-not-allowed ${selected
                              ? 'border-[1.5px] border-[#5B4436] bg-[#5B4436] text-white'
                              : out
                                ? 'border border-dashed border-[#D8CFC3] text-[#A89C92] line-through'
                                : 'border border-[#D8CFC3] bg-white hover:border-[#5B4436]'}`}
                          >
                            <span className="truncate max-w-full">{variant.name}</span>
                            {showPrice && <span className={`text-[11px] font-medium ${selected ? 'text-white/80' : 'text-[#6E6158]'}`}>{money(variant.price || product.price)}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {lowStock && <p className="text-[13px] text-[#8A4B1F]">Only {activeStock} left in {selectedVariant.name}.</p>}
                  </div>
                )}
                {nudge && !ready && !soldOut && (
                  <p role="alert" className="-mt-4 text-[13px] font-medium text-[#A3392B]">{nudgeMessage}</p>
                )}
              </div>

              {/* How many */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-semibold">How many?</span>
                  {hasBundles && hasVariants && <span className="text-[13px] text-[#6E6158]">Mix colours and sizes</span>}
                </div>
                {quantityChoices.length > 1 && (
                  <div role="radiogroup" aria-label="Quantity" className={`grid gap-2 lg:gap-2.5 ${quantityChoices.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {quantityChoices.map(choice => {
                      const selected = quantity === choice.qty;
                      return (
                        <button
                          key={choice.qty}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setQuantity(Math.min(choice.qty, Math.max(activeStock, minQty)))}
                          className={`text-left px-3 lg:px-3.5 py-3 rounded-[14px] flex flex-col gap-0.5 transition-colors cursor-pointer ${selected ? 'border-[1.5px] border-[#5B4436] bg-[#F7F4EF]' : 'border border-[#E4DDD3] bg-white hover:border-[#C9BEB1]'}`}
                        >
                          <span className="text-[12px] lg:text-[13px] font-medium text-[#4E423A]">{choice.qty === 1 ? '1 piece' : `${choice.qty} pieces`}</span>
                          <span className="text-base lg:text-lg font-bold tabular-nums">{money(choice.total)}</span>
                          <span className="text-[11px] lg:text-[12px] text-[#6E6158] tabular-nums">{money(choice.total / choice.qty)} each</span>
                          {choice.saved > 0 && (
                            <span className="mt-1.5 self-start text-[11px] font-bold text-[#1F5A37] bg-[#E3F0E7] px-2 py-0.5 rounded-full">Save ₵{Number.isInteger(choice.saved) ? choice.saved : choice.saved.toFixed(2)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-3.5 text-[13px] text-[#6E6158] flex-wrap">
                  {quantityChoices.length > 1 && <span>Or any amount</span>}
                  <div className="flex items-center border border-[#E4DDD3] rounded-full">
                    <button
                      type="button"
                      aria-label="One less"
                      onClick={() => setQuantity(Math.max(minQty, quantity - 1))}
                      disabled={quantity <= minQty}
                      className="w-11 h-10 flex items-center justify-center text-[#2B211B] text-lg disabled:text-[#C9BEB1] cursor-pointer disabled:cursor-not-allowed"
                    >−</button>
                    <span aria-live="polite" className="min-w-[28px] text-center font-semibold text-[#2B211B] tabular-nums">{quantity}</span>
                    <button
                      type="button"
                      aria-label="One more"
                      onClick={() => setQuantity(selectedVariant || !hasVariants ? Math.min(Math.max(activeStock, minQty), quantity + 1) : quantity + 1)}
                      className="w-11 h-10 flex items-center justify-center text-[#2B211B] text-lg cursor-pointer"
                    >+</button>
                  </div>
                  {minQty > 1 && <span>Minimum order: {minQty}</span>}
                </div>
              </div>

              {/* Buy */}
              <div className="hidden lg:flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => tryAddToCart(false)}
                  disabled={soldOut}
                  className="h-[58px] rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white text-base font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {ctaLabel}
                  {ready && <><span aria-hidden="true" className="opacity-60">·</span><span className="tabular-nums">{money(bundleTotal)}</span></>}
                </button>
                {!soldOut && (
                  <button
                    type="button"
                    onClick={() => tryAddToCart(true)}
                    className="h-[54px] rounded-[14px] border-[1.5px] border-[#5B4436] text-[#2B211B] hover:bg-[#F7F4EF] text-[15px] font-semibold transition-colors cursor-pointer"
                  >
                    Buy now
                  </button>
                )}
              </div>
              {bundleSaved > 0 && ready && (
                <p className="hidden lg:block -mt-4 text-[13px] text-[#1F5A37] font-medium">You save ₵{Number.isInteger(bundleSaved) ? bundleSaved : bundleSaved.toFixed(2)} with this bundle.</p>
              )}
              {product.preorderShipping && (
                <p className="-mt-3 text-[13px] text-[#8A4B1F] flex items-center gap-1.5"><i className="ri-time-line" aria-hidden="true"></i>{product.isPreorder && !/pre-?order/i.test(product.preorderShipping) ? `Pre-order · ${product.preorderShipping}` : product.preorderShipping}</p>
              )}

              <div className="flex items-center gap-2 flex-wrap text-[12px] text-[#6E6158] -mt-2">
                <i className="ri-lock-line text-sm"></i>
                <span>Pay with</span>
                {['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'Card'].map(m => (
                  <span key={m} className="border border-[#E4DDD3] rounded-md px-2 py-0.5 text-[#2B211B] font-medium">{m}</span>
                ))}
              </div>

              <ul className="bg-[#F7F4EF] rounded-2xl px-5 py-4 flex flex-col gap-3.5 text-sm">
                <li className="flex gap-3 items-start"><i className="ri-store-2-line text-lg text-[#5B4436] leading-none mt-0.5"></i><span><strong className="font-semibold">Free store pickup</strong>, or delivery in Accra and across Ghana</span></li>
                <li className="flex gap-3 items-start"><i className="ri-truck-line text-lg text-[#5B4436] leading-none mt-0.5"></i><span>1–2 business days in Accra, 2–4 to other regions</span></li>
                <li className="flex gap-3 items-start"><i className="ri-ruler-line text-lg text-[#5B4436] leading-none mt-0.5"></i><span>All sales final. Check the size guide, or ask us before you order</span></li>
              </ul>

              <div className="border-t border-[#E4DDD3]">
                {product.description && (
                  <details open className="group border-b border-[#E4DDD3]">
                    <summary className="flex justify-between items-center min-h-[56px] text-[15px] font-semibold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      Details<i className="ri-arrow-down-s-line text-xl transition-transform group-open:rotate-180"></i>
                    </summary>
                    <div className="pb-5 text-sm leading-[1.7] text-[#4E423A] max-w-[62ch] whitespace-pre-line">{product.description}</div>
                  </details>
                )}
                <details className="group border-b border-[#E4DDD3]">
                  <summary className="flex justify-between items-center min-h-[56px] text-[15px] font-semibold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    Delivery and returns<i className="ri-arrow-down-s-line text-xl transition-transform group-open:rotate-180"></i>
                  </summary>
                  <div className="pb-5 text-sm leading-[1.7] text-[#4E423A] max-w-[62ch]">
                    Free pickup from our store (ready within 2 hours of payment), delivery in Accra and Greater Accra in 1–2 business days, or 2–4 business days to other regions. We deliver Monday to Saturday and tell you the delivery fee after your order is confirmed. All purchases are final: if an item arrives damaged, defective or incorrect, tell us within 24 hours. <Link href="/returns" className="text-[#5B4436] underline underline-offset-[3px]">Returns &amp; exchanges policy</Link>.
                  </div>
                </details>
                <details id="reviews" className="group border-b border-[#E4DDD3]">
                  <summary className="flex justify-between items-center min-h-[56px] text-[15px] font-semibold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    Reviews<i className="ri-arrow-down-s-line text-xl transition-transform group-open:rotate-180"></i>
                  </summary>
                  <div className="pb-5">
                    <ProductReviews productId={product.id} />
                  </div>
                </details>
              </div>
            </section>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="py-16 lg:py-24 bg-white" data-product-shop>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
              <h2 className="font-serif font-medium text-[28px] lg:text-[34px] mb-8 lg:mb-10">You may also like</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} {...p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Phone: price and add-to-bag always in reach */}
      <BodyPortal>
      <div className="lg:hidden fixed left-0 right-0 bottom-0 z-40 bg-white border-t border-[#EFEAE3] shadow-[0_-6px_20px_rgba(43,33,27,0.06)] px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col min-w-[92px]">
            <span className="text-[12px] text-[#6E6158]">{quantity === 1 ? '1 piece' : `${quantity} pieces`}</span>
            <span className="text-lg font-bold tabular-nums text-[#2B211B]">{priceVaries && !selectedVariant ? `From ${money(minVariantPrice)}` : money(bundleTotal)}</span>
          </div>
          <button
            type="button"
            onClick={() => tryAddToCart(false)}
            disabled={soldOut}
            className="flex-1 h-[54px] rounded-[14px] bg-[#5B4436] active:bg-[#47362C] text-white text-base font-semibold cursor-pointer disabled:opacity-50"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
      </BodyPortal>

      <SizeGuideModal
        isOpen={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        category={detectSizeGuideCategory(product.variants?.map((v: any) => v.name || '') || []) || 'General'}
      />
    </>
  );
}
