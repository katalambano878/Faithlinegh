'use client';

import Link from 'next/link';

export interface CollectionCard {
  name: string;
  slug: string;
  image?: string;
  tag: string;
  icon: string;
  /** Background position when using the shared grid fallback image */
  gridPosition?: string;
}

const GRID_FALLBACK_IMAGE = '/collections-grid.png';

const DEFAULT_CARDS: CollectionCard[] = [
  { name: 'Bags', slug: 'bags', tag: 'Everyday', icon: 'ri-shopping-bag-line', gridPosition: '0% 0%' },
  { name: 'Tops', slug: 'tops', tag: 'Essentials', icon: 'ri-shirt-line', gridPosition: '50% 0%' },
  { name: 'Co-ord sets', slug: 'co-ord-sets', tag: 'Statement', icon: 'ri-hand-heart-line', gridPosition: '100% 0%' },
  { name: 'Bottoms', slug: 'bottoms', tag: 'New In', icon: 'ri-sparkling-line', gridPosition: '0% 100%' },
  { name: 'Beauty & intimates', slug: 'beauty-intimates', tag: 'Curated', icon: 'ri-shopping-bag-3-line', gridPosition: '50% 100%' },
  { name: 'Athleisure', slug: 'athleisure', tag: 'Featured', icon: 'ri-star-line', gridPosition: '100% 100%' },
];

interface CollectionGridProps {
  categories?: { name: string; slug: string; image?: string }[];
}

export default function CollectionGrid({ categories = [] }: CollectionGridProps) {
  const cards = DEFAULT_CARDS.map((card, index) => {
    const match = categories.find(
      (c) => c.slug === card.slug || c.name.toLowerCase() === card.name.toLowerCase()
    );
    const fallback = categories[index];
    return {
      ...card,
      slug: match?.slug || fallback?.slug || card.slug,
      name: match?.name || fallback?.name || card.name,
      image: match?.image || fallback?.image,
    };
  });

  return (
    <div className="mt-10 sm:mt-14 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
      {cards.map((card) => (
        <Link
          key={card.slug}
          href={`/shop?category=${encodeURIComponent(card.slug)}`}
          className="group relative overflow-hidden rounded-2xl sm:rounded-3xl aspect-[4/5] shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {card.image ? (
            <img
              src={card.image}
              alt={card.name}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div
              className="absolute inset-0 bg-cover bg-no-repeat transition-transform duration-700 group-hover:scale-105"
              style={{
                backgroundImage: `url(${GRID_FALLBACK_IMAGE})`,
                backgroundSize: '300% 200%',
                backgroundPosition: card.gridPosition,
              }}
              role="img"
              aria-label={card.name}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/5" />

          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-800">
            <i className={`${card.icon} text-xs`} aria-hidden />
            {card.tag}
          </div>

          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex items-end justify-between gap-3">
            <div className="text-left">
              <p className="text-base sm:text-lg font-bold text-white">{card.name}</p>
              <p className="text-xs sm:text-sm text-white/80">Shop now</p>
            </div>
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-900 transition-transform group-hover:translate-x-0.5">
              <i className="ri-arrow-right-line text-sm sm:text-base" aria-hidden />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
