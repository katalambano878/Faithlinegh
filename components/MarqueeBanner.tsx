'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface BannerItem {
  id: string;
  title: string | null;
  subtitle: string | null;
  button_text: string | null;
  button_url: string | null;
  background_color: string | null;
  text_color: string | null;
}

const DEFAULT_MESSAGES = [
  'Free shipping on orders over GH₵800',
  'Fast delivery within 48 hours',
  'Easy returns within 7 days',
  'Shop our latest sale — new styles added weekly',
];

function buildMarqueeItems(banners: BannerItem[]): { id: string; text: string; href?: string }[] {
  if (banners.length === 0) {
    return DEFAULT_MESSAGES.map((text, index) => ({ id: `default-${index}`, text }));
  }

  return banners.map((banner) => ({
    id: banner.id,
    text: [banner.title, banner.subtitle].filter(Boolean).join(' — '),
    href: banner.button_url || undefined,
  }));
}

export default function MarqueeBanner() {
  const [items, setItems] = useState<{ id: string; text: string; href?: string }[]>(
    DEFAULT_MESSAGES.map((text, index) => ({ id: `default-${index}`, text }))
  );
  const [colors, setColors] = useState({ bg: '#E6DFD5', text: '#5B4436' });

  useEffect(() => {
    async function fetchBanners() {
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('banners')
          .select('id, title, subtitle, button_text, button_url, background_color, text_color')
          .eq('is_active', true)
          .eq('position', 'top')
          .or(`start_date.is.null,start_date.lte.${now}`)
          .or(`end_date.is.null,end_date.gte.${now}`)
          .order('sort_order', { ascending: true });

        if (error || !data?.length) return;

        setItems(buildMarqueeItems(data));
        const first = data[0];
        setColors({
          bg: first.background_color || '#E6DFD5',
          text: first.text_color || '#5B4436',
        });
      } catch {
        // Keep defaults
      }
    }

    fetchBanners();
  }, []);

  const loopItems = [...items, ...items];

  return (
    <div
      className="relative overflow-hidden border-b border-brand-brown/10"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <div className="flex animate-marquee whitespace-nowrap py-2.5">
        {loopItems.map((item, index) => (
          <span
            key={`${item.id}-${index}`}
            className="mx-8 inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.22em]"
          >
            <span className="h-1 w-1 rounded-full bg-current opacity-70" aria-hidden />
            {item.href ? (
              <Link href={item.href} className="hover:opacity-80 transition-opacity">
                {item.text}
              </Link>
            ) : (
              item.text
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
