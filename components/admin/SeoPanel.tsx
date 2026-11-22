'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Product SEO: a score with a checklist, Google and WhatsApp previews,
 * "write it for me", search tags as chips with suggestions, a share photo,
 * and a web address check. The page title is stored without the brand;
 * the site adds " | Faithlinegh" to every page title itself.
 */

export const SEO_BRAND = 'Faithlinegh';
const BRAND_SUFFIX = ` | ${SEO_BRAND}`;
const SITE_HOST = 'faithlinegh.com';

/** Remove a trailing "| Faithlinegh" / "– Faithline" the old editor added. */
export function stripBrand(title: string): string {
  return String(title || '').replace(/\s*[|–—-]\s*faithline(gh)?\s*$/i, '').trim();
}

export function defaultSeo(name: string, description: string, category?: string) {
  const plain = String(description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const title = name ? (category && `${name} – ${category}`.length + BRAND_SUFFIX.length <= 60 ? `${name} – ${category}` : name) : '';
  const tail = ' Pickup or delivery across Ghana in 48 hours.';
  let desc = '';
  if (plain) {
    const room = 160 - tail.length;
    let cut = plain;
    if (cut.length > room) {
      const sentenceEnd = cut.slice(0, room).lastIndexOf('. ');
      cut = sentenceEnd > 60 ? cut.slice(0, sentenceEnd + 1) : `${cut.slice(0, room - 1).replace(/\s+\S*$/, '')}…`;
    }
    desc = `${cut}${/[.!?…]$/.test(cut) ? '' : '.'}${tail}`;
  } else if (name) {
    desc = `Shop the ${name} at ${SEO_BRAND}. Quality, affordable fashion with free store pickup or delivery across Ghana within 48 hours.`;
  }
  return { title, description: desc.slice(0, 160) };
}

type Props = {
  productId?: string;
  productName: string;
  description: string;
  category?: string;
  colors: string[];
  images: string[];
  savedSlug?: string;
  title: string;
  setTitle: (v: string) => void;
  metaDescription: string;
  setMetaDescription: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  onSlugTyped: () => void;
  slugify: (v: string) => string;
  tags: string[];
  setTags: (v: string[]) => void;
  shareImage: string;
  setShareImage: (v: string) => void;
};

type Check = { label: string; ok: boolean; tip: string; weight: number };

function Meter({ value, min, max }: { value: number; min: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const tone = value === 0 ? 'bg-gray-200' : value < min ? 'bg-amber-400' : value > max ? 'bg-red-500' : 'bg-emerald-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mt-2" aria-hidden="true">
      <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function SeoPanel(p: Props) {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [tagInput, setTagInput] = useState('');
  const [writing, setWriting] = useState(false);
  const [aiError, setAiError] = useState('');

  const fullTitle = `${p.title || p.productName || 'Product'}${BRAND_SUFFIX}`;
  const desc = p.metaDescription;
  const url = `${SITE_HOST}/product/${p.slug || 'product'}`;
  const shareImg = p.shareImage || p.images[0] || '';
  const nameWords = p.productName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const plainBody = p.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const checks: Check[] = [
    { label: 'Page title is a good length', ok: fullTitle.length >= 25 && fullTitle.length <= 60, weight: 15,
      tip: fullTitle.length > 60 ? 'Shorten it. Google cuts titles after about 60 characters.' : 'Add a word or two, like the category or colour.' },
    { label: 'Title says what the product is', ok: nameWords.length === 0 || nameWords.some(w => (p.title || p.productName).toLowerCase().includes(w)), weight: 10,
      tip: 'Use the product name in the title.' },
    { label: 'Description is a good length', ok: desc.length >= 110 && desc.length <= 160, weight: 15,
      tip: desc.length > 160 ? 'Trim it to 160 characters so Google shows all of it.' : 'Write at least 110 characters: what it is, why it’s great, how to get it.' },
    { label: 'Description mentions pickup or delivery', ok: /deliver|pickup|pick up|collect/i.test(desc), weight: 5,
      tip: 'Shoppers in Ghana click more when they see how they get it.' },
    { label: 'Web address is clear', ok: p.slug.length >= 4 && (nameWords.length === 0 || nameWords.some(w => p.slug.includes(p.slugify(w)))), weight: 15,
      tip: 'Use the product name, e.g. bare-capri-set, not a single letter.' },
    { label: 'Product has at least 3 photos', ok: p.images.length >= 3, weight: 10,
      tip: p.images.length === 0 ? 'Add photos. Products without photos rarely show up.' : `Add ${3 - p.images.length} more photo${3 - p.images.length === 1 ? '' : 's'} (front, back, detail).` },
    { label: 'Product description is detailed', ok: plainBody.length >= 120, weight: 10,
      tip: 'Describe fabric, fit and how to wear it (at least 2–3 sentences) on the General tab.' },
    { label: 'Category is chosen', ok: !!p.category, weight: 10, tip: 'Pick a category on the General tab.' },
    { label: 'At least 3 search tags', ok: p.tags.length >= 3, weight: 10, tip: 'Add words shoppers type, e.g. “co-ord set”, “ladies two piece”.' },
  ];
  const score = Math.round(checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0) / checks.reduce((s, c) => s + c.weight, 0) * 100);
  const scoreTone = score >= 80 ? { ring: '#10b981', label: 'Good', text: 'text-emerald-700' }
    : score >= 55 ? { ring: '#f59e0b', label: 'Fair', text: 'text-amber-700' }
    : { ring: '#ef4444', label: 'Needs work', text: 'text-red-700' };
  const todo = checks.filter(c => !c.ok);

  const suggestions = useMemo(() => {
    const type = p.productName.trim().split(/\s+/).slice(-1)[0]?.toLowerCase() || '';
    const out = new Set<string>();
    if (p.productName) out.add(p.productName.toLowerCase());
    if (p.category) out.add(p.category.toLowerCase());
    if (type && type.length > 2) { out.add(`ladies ${type}`); out.add(`${type} in ghana`); out.add(`${type} accra`); }
    p.colors.slice(0, 4).forEach(c => type && out.add(`${c.toLowerCase()} ${type}`));
    return [...out].filter(t => !p.tags.map(x => x.toLowerCase()).includes(t)).slice(0, 8);
  }, [p.productName, p.category, p.colors, p.tags]);

  const addTags = (raw: string) => {
    const next = raw.split(',').map(t => t.trim().toLowerCase()).filter(t => t && t.length <= 40);
    if (!next.length) return;
    p.setTags([...new Set([...p.tags, ...next])].slice(0, 20));
    setTagInput('');
  };

  const writeForMe = async () => {
    setWriting(true);
    setAiError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/products/generate-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ productName: p.productName, description: plainBody, category: p.category, colors: p.colors, imageUrl: p.images[0] || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not write it right now.');
      if (json.title) p.setTitle(stripBrand(json.title).slice(0, 60 - BRAND_SUFFIX.length));
      if (json.description) p.setMetaDescription(String(json.description).slice(0, 160));
      if (Array.isArray(json.tags) && json.tags.length) p.setTags([...new Set([...p.tags, ...json.tags.map((t: string) => String(t).toLowerCase().trim()).filter(Boolean)])].slice(0, 20));
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setWriting(false);
    }
  };

  const useDefaults = () => {
    const d = defaultSeo(p.productName, p.description, p.category);
    p.setTitle(d.title);
    p.setMetaDescription(d.description);
  };

  const slugChanged = !!p.savedSlug && p.slug && p.slug !== p.savedSlug;
  const titleRoom = 60 - BRAND_SUFFIX.length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header + score */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-5 rounded-2xl border border-gray-200 bg-white">
        <div className="relative w-24 h-24 flex-shrink-0" role="img" aria-label={`SEO score ${score} out of 100`}>
          <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke={scoreTone.ring} strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 97.4} 97.4`} className="transition-all duration-500" />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{score}</span>
            <span className={`text-[11px] font-semibold mt-0.5 ${scoreTone.text}`}>{scoreTone.label}</span>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900">How this product shows up on Google and WhatsApp</h3>
          <p className="text-sm text-gray-600 mt-1">
            {todo.length === 0 ? 'Everything important is in place.' : `${todo.length} thing${todo.length === 1 ? '' : 's'} to improve. The list below says how.`}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={writeForMe} disabled={writing || !p.productName}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50">
              <i className={writing ? 'ri-loader-4-line animate-spin' : 'ri-sparkling-2-line'} aria-hidden="true" />
              {writing ? 'Writing…' : 'Write it for me'}
            </button>
            <button type="button" onClick={useDefaults} disabled={!p.productName}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
              <i className="ri-refresh-line" aria-hidden="true" /> Fill from product details
            </button>
          </div>
          {aiError && <p className="text-xs text-red-700 mt-2" role="alert">{aiError}</p>}
        </div>
      </div>

      {/* Checklist */}
      <ul className="grid sm:grid-cols-2 gap-2" aria-label="SEO checklist">
        {checks.map(c => (
          <li key={c.label} className={`flex gap-2.5 p-3 rounded-xl border ${c.ok ? 'border-gray-100 bg-white' : 'border-amber-200 bg-amber-50/60'}`}>
            <i className={`${c.ok ? 'ri-checkbox-circle-fill text-emerald-600' : 'ri-error-warning-fill text-amber-500'} text-lg leading-5`} aria-hidden="true" />
            <div className="min-w-0">
              <p className={`text-sm font-medium ${c.ok ? 'text-gray-700' : 'text-gray-900'}`}>{c.label}</p>
              {!c.ok && <p className="text-xs text-gray-600 mt-0.5">{c.tip}</p>}
            </div>
          </li>
        ))}
      </ul>

      {/* Previews */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <div className="p-4 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Google</p>
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="tablist" aria-label="Preview size">
              {(['mobile', 'desktop'] as const).map(d => (
                <button key={d} type="button" role="tab" aria-selected={device === d} onClick={() => setDevice(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${device === d ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  <i className={d === 'mobile' ? 'ri-smartphone-line mr-1' : 'ri-computer-line mr-1'} aria-hidden="true" />{d === 'mobile' ? 'Phone' : 'Computer'}
                </button>
              ))}
            </div>
          </div>
          <div className={`font-[arial,sans-serif] ${device === 'mobile' ? 'max-w-[360px]' : 'max-w-[600px]'}`}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                <img src="/favicon.ico" alt="" className="w-4 h-4" />
              </span>
              <span className="leading-tight">
                <span className="block text-[14px] text-[#202124]">{SEO_BRAND}</span>
                <span className="block text-[12px] text-[#4d5156] truncate max-w-[280px]">https://{SITE_HOST} › product › {p.slug || '…'}</span>
              </span>
            </div>
            <div className={device === 'mobile' ? 'flex gap-3' : ''}>
              <div className="min-w-0 flex-1">
                <p className={`text-[#1a0dab] leading-snug ${device === 'mobile' ? 'text-[18px] line-clamp-2' : 'text-[20px] truncate'}`}>{fullTitle}</p>
                <p className="text-[14px] text-[#4d5156] leading-[1.58] mt-1 line-clamp-3">{desc || <span className="italic text-gray-400">No description yet. Google will pick some text from the page.</span>}</p>
              </div>
              {device === 'mobile' && shareImg && <img src={shareImg} alt="" className="w-[92px] h-[92px] rounded-lg object-cover flex-shrink-0 mt-1" />}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-gray-200 bg-[#ECE5DD]">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Shared on WhatsApp</p>
          <div className="ml-auto max-w-[290px] rounded-lg bg-[#D9FDD3] p-1 shadow-sm">
            <div className="rounded-md bg-[#F7F8FA] overflow-hidden">
              {shareImg ? <img src={shareImg} alt="" className="w-full aspect-[1.91/1] object-cover" /> : <div className="w-full aspect-[1.91/1] bg-gray-200 flex items-center justify-center text-xs text-gray-500">No photo</div>}
              <div className="px-2.5 py-2">
                <p className="text-[13px] font-semibold text-[#111b21] line-clamp-2">{fullTitle}</p>
                <p className="text-[12px] text-[#667781] line-clamp-2 mt-0.5">{desc}</p>
                <p className="text-[11px] text-[#667781] mt-1">{SITE_HOST}</p>
              </div>
            </div>
            <p className="px-1.5 pt-1 text-[13px] text-[#027EB5] break-all">https://{url}</p>
          </div>
        </div>
      </div>

      {/* Title */}
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="seo-title" className="text-sm font-semibold text-gray-900">Page title</label>
          <span className={`text-xs tabular-nums ${fullTitle.length > 60 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{fullTitle.length}/60 with “{BRAND_SUFFIX.trim()}”</span>
        </div>
        <div className="mt-1.5 flex items-stretch rounded-xl border-2 border-gray-200 focus-within:border-gray-900 overflow-hidden">
          <input id="seo-title" type="text" value={p.title} maxLength={90}
            onChange={(e) => p.setTitle(stripBrand(e.target.value))}
            placeholder={p.productName || 'e.g. Bare Capri Set – Co-ord sets'}
            className="flex-1 min-w-0 px-4 py-3 outline-none" />
          <span className="px-3 flex items-center text-sm text-gray-400 bg-gray-50 border-l border-gray-200 whitespace-nowrap">{BRAND_SUFFIX}</span>
        </div>
        <Meter value={fullTitle.length} min={25} max={60} />
        <p className="text-xs text-gray-500 mt-1.5">The shop name is added for you. Room for {Math.max(0, titleRoom - p.title.length)} more characters.</p>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="seo-desc" className="text-sm font-semibold text-gray-900">Search description</label>
          <span className={`text-xs tabular-nums ${desc.length > 160 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{desc.length}/160</span>
        </div>
        <textarea id="seo-desc" rows={3} value={desc} onChange={(e) => p.setMetaDescription(e.target.value)}
          placeholder="What it is, what makes it great, and how to get it (pickup or delivery)."
          className="mt-1.5 w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gray-900 outline-none resize-none" />
        <Meter value={desc.length} min={110} max={160} />
        <p className="text-xs text-gray-500 mt-1.5">Shown under the title on Google and in WhatsApp link previews. Aim for 110–160 characters.</p>
      </div>

      {/* Web address */}
      <div>
        <label htmlFor="seo-slug" className="text-sm font-semibold text-gray-900">Web address</label>
        <div className="mt-1.5 flex items-stretch rounded-xl border-2 border-gray-200 focus-within:border-gray-900 overflow-hidden">
          <span className="px-3 flex items-center text-sm text-gray-500 bg-gray-50 border-r border-gray-200 whitespace-nowrap">{SITE_HOST}/product/</span>
          <input id="seo-slug" type="text" value={p.slug}
            onChange={(e) => { p.onSlugTyped(); p.setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '')); }}
            onBlur={() => p.setSlug(p.slugify(p.slug))}
            className="flex-1 min-w-0 px-3 py-3 outline-none" placeholder="bare-capri-set" />
          {p.productName && p.slug !== p.slugify(p.productName) && (
            <button type="button" onClick={() => { p.onSlugTyped(); p.setSlug(p.slugify(p.productName)); }}
              className="px-3 text-xs font-semibold text-gray-700 bg-gray-50 border-l border-gray-200 hover:bg-gray-100 whitespace-nowrap">
              Use the name
            </button>
          )}
        </div>
        {p.slug.length > 0 && p.slug.length < 4 && (
          <p className="text-xs text-amber-700 mt-1.5">“{p.slug}” is too short for people and Google to recognise. Tap “Use the name”.</p>
        )}
        {slugChanged && (
          <p className="text-xs text-gray-600 mt-1.5"><i className="ri-links-line mr-1" aria-hidden="true" />Links to the old address (/product/{p.savedSlug}) will still open this product.</p>
        )}
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="seo-tags" className="text-sm font-semibold text-gray-900">Search tags</label>
        <p className="text-xs text-gray-500 mt-0.5">Words shoppers type to find this. They also help the store’s own search.</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 p-2 rounded-xl border-2 border-gray-200 focus-within:border-gray-900 min-h-[52px]">
          {p.tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-gray-100 text-sm text-gray-800">
              {t}
              <button type="button" onClick={() => p.setTags(p.tags.filter(x => x !== t))} className="w-5 h-5 rounded-full hover:bg-gray-200 flex items-center justify-center" aria-label={`Remove ${t}`}>
                <i className="ri-close-line text-xs" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input id="seo-tags" type="text" value={tagInput}
            onChange={(e) => { if (e.target.value.endsWith(',')) addTags(e.target.value); else setTagInput(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addTags(tagInput); }
              if (e.key === 'Backspace' && !tagInput && p.tags.length) p.setTags(p.tags.slice(0, -1));
            }}
            onBlur={() => tagInput.trim() && addTags(tagInput)}
            placeholder={p.tags.length ? 'Add another…' : 'Type a word and press Enter'}
            className="flex-1 min-w-[140px] px-1.5 py-1 outline-none text-sm" />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500 mr-1">Suggestions:</span>
            {suggestions.map(sug => (
              <button key={sug} type="button" onClick={() => addTags(sug)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-xs text-gray-700 hover:border-gray-500 hover:bg-gray-50">
                <i className="ri-add-line" aria-hidden="true" />{sug}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Share photo */}
      {p.images.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-900">Photo for link previews</p>
          <p className="text-xs text-gray-500 mt-0.5">Shown when someone shares this product on WhatsApp, Facebook or Instagram.</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Photo for link previews">
            {p.images.slice(0, 10).map((img, i) => {
              const on = (p.shareImage || p.images[0]) === img;
              return (
                <button key={img} type="button" role="radio" aria-checked={on} onClick={() => p.setShareImage(i === 0 ? '' : img)}
                  className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 ${on ? 'border-gray-900' : 'border-transparent opacity-80 hover:opacity-100'}`}>
                  <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  {on && <i className="ri-check-line absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
