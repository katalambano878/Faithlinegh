'use client';

import { useState } from 'react';
import Link from 'next/link';
import LazyImage from './LazyImage';
import { useCart } from '@/context/CartContext';

const COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#EF4444', blue: '#3B82F6',
  navy: '#1E3A5F', green: '#22C55E', yellow: '#EAB308', orange: '#F97316',
  pink: '#EC4899', purple: '#A855F7', brown: '#92400E', beige: '#D4C5A9',
  grey: '#6B7280', gray: '#6B7280', cream: '#FFFDD0', teal: '#14B8A6',
  maroon: '#800000', coral: '#FF7F50', burgundy: '#800020', olive: '#808000',
  tan: '#D2B48C', khaki: '#C3B091', charcoal: '#36454F', ivory: '#FFFFF0',
  gold: '#FFD700', silver: '#C0C0C0', rose: '#FF007F', lavender: '#E6E6FA',
  mint: '#98FB98', peach: '#FFDAB9', wine: '#722F37', denim: '#1560BD',
  nude: '#E3BC9A', camel: '#C19A6B', sage: '#BCB88A', rust: '#B7410E',
  mustard: '#FFDB58', plum: '#8E4585', lilac: '#C8A2C8', stone: '#928E85',
  sand: '#C2B280', taupe: '#483C32', mauve: '#E0B0FF', sky: '#87CEEB',
  forest: '#228B22', cobalt: '#0047AB', emerald: '#50C878', scarlet: '#FF2400',
  aqua: '#00FFFF', turquoise: '#40E0D0', indigo: '#4B0082', crimson: '#DC143C',
  magenta: '#FF00FF', cyan: '#00FFFF', chocolate: '#7B3F00', coffee: '#6F4E37',
};

export function getColorHex(colorName: string): string | null {
  const lower = colorName.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export interface ColorVariant {
  name: string;
  hex: string;
}

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  inStock?: boolean;
  maxStock?: number;
  moq?: number;
  hasVariants?: boolean;
  minVariantPrice?: number;
  colorVariants?: ColorVariant[];
  /** Best bundle deal label, e.g. "3 for ₵255" */
  bundleLabel?: string;
  /** Full bundle tiers so quick-add carries deals into the cart */
  bundlePricing?: { qty: number; total_price: number }[] | null;
}

export default function ProductCard({
  id,
  slug,
  name,
  price,
  originalPrice,
  image,
  rating = 0,
  reviewCount = 0,
  badge,
  inStock = true,
  maxStock = 50,
  moq = 1,
  hasVariants = false,
  minVariantPrice,
  colorVariants = [],
  bundleLabel,
  bundlePricing
}: ProductCardProps) {
  const { addToCart } = useCart();
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const displayPrice = hasVariants && minVariantPrice ? minVariantPrice : price;
  const discount = originalPrice ? Math.round((1 - displayPrice / originalPrice) * 100) : 0;
  const MAX_SWATCHES = 4;

  return (
    <article className="group relative aspect-[4/5] w-full overflow-hidden rounded-[1.25rem] bg-brand-cream shadow-[0_2px_14px_-10px_rgba(61,43,33,0.35)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-26px_rgba(61,43,33,0.6)]">
      {/* Product image */}
      <LazyImage
        src={image}
        alt={name}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.08]"
      />

      {/* Gradient scrim for legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-brown/95 via-brand-brown/25 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Stretched navigation link (keeps whole card clickable, no nested anchors) */}
      <Link href={`/product/${slug}`} className="absolute inset-0 z-10" aria-label={name} />

      {/* Top badges */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        {bundleLabel ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-700/90 backdrop-blur-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white shadow-sm">
            <i className="ri-stack-line text-[9px]" />
            {bundleLabel}
          </span>
        ) : badge ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-brown shadow-sm">
            <i className="ri-sparkling-2-fill text-brand-gold text-[9px]" />
            {badge}
          </span>
        ) : <span />}
        {discount > 0 && (
          <span className="rounded-full bg-brand-oxblood px-2 py-0.5 text-[10px] font-bold text-white shadow-md shadow-brand-oxblood/40">
            -{discount}%
          </span>
        )}
      </div>

      {/* Out of stock */}
      {!inStock && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-brand-brown/40 backdrop-blur-[2px]">
          <span className="rounded-full bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-brown shadow-lg">
            Sold Out
          </span>
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-3.5">
        <div className="pointer-events-none flex items-center justify-between gap-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold">
            Faithlinegh
          </p>
          {rating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-white/90">
              <i className="ri-star-fill text-brand-gold text-[10px]" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>

        <h3 className="pointer-events-none mt-1 text-sm font-bold leading-snug text-white line-clamp-1 drop-shadow-sm">
          {name}
        </h3>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            {colorVariants.length > 0 && (
              <div className="mb-1.5 flex items-center gap-1.5">
                {colorVariants.slice(0, MAX_SWATCHES).map((color) => (
                  <button
                    key={color.name}
                    title={color.name}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveColor(activeColor === color.name ? null : color.name);
                    }}
                    className={`relative z-30 h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-white/60 transition-all duration-200 ${
                      activeColor === color.name ? 'scale-125 ring-2 ring-brand-gold' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
                {colorVariants.length > MAX_SWATCHES && (
                  <span className="ml-0.5 text-[10px] text-white/60">+{colorVariants.length - MAX_SWATCHES}</span>
                )}
              </div>
            )}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-extrabold leading-none text-white truncate">
                {hasVariants && minVariantPrice ? (
                  <><span className="text-[9px] font-semibold text-white/70 mr-0.5">From</span>₵{minVariantPrice.toFixed(2)}</>
                ) : (
                  `₵${price.toFixed(2)}`
                )}
              </span>
              {originalPrice && (
                <span className="text-[11px] text-white/50 line-through leading-none">₵{originalPrice.toFixed(2)}</span>
              )}
            </div>
          </div>

          {hasVariants ? (
            <span className="relative z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-brown shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-brand-gold group-hover:to-brand-carton group-hover:text-white shrink-0">
              <i className="ri-arrow-right-line text-base" />
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (inStock) addToCart({ id, name, price, image, quantity: moq, slug, maxStock, moq, bundlePricing: bundlePricing || null });
              }}
              disabled={!inStock}
              className="relative z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-brown shadow-lg transition-all duration-300 hover:scale-110 hover:bg-gradient-to-br hover:from-brand-gold hover:to-brand-carton hover:text-white shrink-0 disabled:bg-white/40 disabled:text-brand-brown/40 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100"
              aria-label={moq > 1 ? `Add ${moq} to cart` : 'Add to cart'}
            >
              <i className="ri-shopping-bag-3-line text-base" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
