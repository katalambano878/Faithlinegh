'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { localImagePath } from '@/lib/img';
import { useRouter } from 'next/navigation';

export type ArrivalItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  image: string;
};

const VISIBLE = 5;

export default function ArrivalsAccordion({ items }: { items: ArrivalItem[] }) {
  const router = useRouter();
  const [active, setActive] = useState(1);
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);

  const windowSize = Math.min(VISIBLE, items.length);
  const canCycle = items.length > windowSize;
  const focusSlot = Math.min(1, Math.max(0, windowSize - 1));

  // Auto-play: slide one product at a time, pausing on hover
  useEffect(() => {
    if (paused || !canCycle) return;
    const id = setInterval(() => {
      setOffset((o) => (o + 1) % items.length);
    }, 2800);
    return () => clearInterval(id);
  }, [paused, canCycle, items.length]);

  if (!items.length) return null;

  // Build the visible window (slides one item at a time through all items)
  const view: ArrivalItem[] = Array.from(
    { length: windowSize },
    (_, i) => items[(offset + i) % items.length]
  );

  const activeIdx = Math.min(active, windowSize - 1);

  const go = (slug: string) => router.push(`/product/${slug}`);

  return (
    <div>
      {/* Accordion gallery */}
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          setPaused(false);
          setActive(focusSlot);
        }}
        className="flex h-[130px] flex-col gap-2 sm:h-[180px] sm:flex-row sm:gap-2"
      >
        {view.map((item, i) => {
          const isActive = i === activeIdx;
          const discount =
            item.originalPrice && item.originalPrice > item.price
              ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
              : 0;

          return (
            <div
              key={`${item.id}-${i}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => (isActive ? go(item.slug) : setActive(i))}
              className={`group relative min-h-0 min-w-0 cursor-pointer overflow-hidden rounded-[1.5rem] bg-brand-cream shadow-[0_4px_20px_-12px_rgba(61,43,33,0.45)] transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${
                isActive
                  ? 'flex-[2] ring-2 ring-brand-gold shadow-[0_28px_55px_-26px_rgba(201,162,75,0.6)]'
                  : 'flex-[1] grayscale-[0.15] hover:grayscale-0'
              }`}
            >
              <Image
                src={localImagePath(item.image)}
                alt={item.name}
                fill
                sizes="(max-width:640px) 100vw, 40vw"
                className="object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05]"
              />

              {/* Color wash + scrim */}
              <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
                  isActive
                    ? 'bg-gradient-to-t from-brand-brown/95 via-brand-brown/25 to-brand-gold/10'
                    : 'bg-gradient-to-t from-brand-brown/90 via-brand-brown/35 to-brand-brown/10'
                }`}
              />

              {/* Discount badge */}
              {discount > 0 && (
                <span className="absolute right-2 top-2 z-10 rounded-full bg-gradient-to-r from-brand-oxblood to-brand-coral px-1.5 py-0.5 text-[8px] font-extrabold text-white shadow-sm">
                  -{discount}%
                </span>
              )}

              {/* New chip */}
              <span
                className={`absolute left-2 top-2 z-10 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-brand-gold to-brand-carton px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm transition-opacity duration-300 ${
                  isActive ? 'opacity-100' : 'opacity-0 sm:opacity-100'
                }`}
              >
                <i className="ri-sparkling-2-fill text-[7px]" />
                New
              </span>

              {/* Collapsed vertical label (desktop) */}
              {!isActive && (
                <div className="pointer-events-none absolute inset-0 hidden items-end justify-center pb-3 sm:flex">
                  <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold uppercase tracking-[0.16em] text-white/90 drop-shadow line-clamp-1 max-h-[70%]">
                    {item.name}
                  </span>
                </div>
              )}

              {/* Active content */}
              <div
                className={`absolute inset-x-0 bottom-0 z-10 p-2.5 sm:p-3 transition-all duration-500 ${
                  isActive ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 sm:opacity-0'
                }`}
              >
                <h3 className="text-xs sm:text-sm font-bold leading-tight text-white drop-shadow-sm line-clamp-1">
                  {item.name}
                </h3>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-white">
                    ₵{Number(item.price || 0).toFixed(2)}
                  </span>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-brown shadow-sm transition-all duration-300 group-hover:scale-110">
                    <i className="ri-arrow-right-line text-xs" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
