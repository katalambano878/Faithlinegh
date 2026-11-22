'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { adminRequest } from '@/lib/admin-request';
import { downloadCsv, todayStamp } from '@/lib/csv';

type Variant = { id: string; size: string; color: string; quantity: number; price: number };
type Item = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category: string;
  status: string;
  image: string;
  price: number;
  stock: number;
  threshold: number;
  preorder: boolean;
  variants: Variant[];
  state: 'out' | 'low' | 'good';
  soldOutOptions: number;
  value: number;
};

type Filter = 'all' | 'low' | 'out' | 'good' | 'options';

const cedi = (n: number) => `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function toItem(p: any): Item {
  const variants: Variant[] = (p.product_variants || []).map((v: any) => ({
    id: v.id,
    size: v.name && v.name !== v.option2 ? v.name : '',
    color: v.option2 || '',
    quantity: Number(v.quantity) || 0,
    price: Number(v.price) > 0 ? Number(v.price) : Number(p.price) || 0,
  })).sort((a: Variant, b: Variant) => a.color.localeCompare(b.color));
  const hasVariants = variants.length > 0;
  const stock = hasVariants ? variants.reduce((s, v) => s + v.quantity, 0) : Number(p.quantity) || 0;
  const threshold = Number.isFinite(Number(p.metadata?.low_stock_threshold)) ? Number(p.metadata.low_stock_threshold) : 5;
  const imgs = [...(p.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
  const value = hasVariants
    ? variants.reduce((s, v) => s + v.quantity * v.price, 0)
    : stock * (Number(p.price) || 0);
  return {
    id: p.id,
    name: String(p.name || '').trim(),
    slug: p.slug,
    sku: p.sku || '',
    category: p.categories?.name || '',
    status: String(p.status || ''),
    image: imgs[0]?.url || '',
    price: Number(p.price) || 0,
    stock,
    threshold,
    preorder: p.metadata?.availability === 'preorder',
    variants,
    state: stock === 0 ? 'out' : stock <= threshold ? 'low' : 'good',
    soldOutOptions: variants.filter(v => v.quantity === 0).length,
    value,
  };
}

function StockInput({ value, onSave, label }: { value: number; onSave: (q: number) => Promise<void>; label: string }) {
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(String(value)); }, [value]);
  const dirty = draft !== String(value);
  const save = async () => {
    const q = Math.max(0, Math.floor(Number(draft)));
    if (!Number.isFinite(q)) { setDraft(String(value)); return; }
    setSaving(true);
    setError('');
    try { await onSave(q); } catch (e: any) { setError(e.message); setDraft(String(value)); } finally { setSaving(false); }
  };
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={label}
          value={draft}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') setDraft(String(value)); }}
          className={`w-16 h-9 px-2 text-center rounded-lg border tabular-nums font-semibold ${dirty ? 'border-gray-900' : 'border-gray-200'} ${value === 0 && !dirty ? 'text-red-700 bg-red-50' : 'text-gray-900 bg-white'}`}
        />
        {dirty && (
          <button type="button" onClick={save} disabled={saving} className="h-9 px-2.5 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-50">
            {saving ? '…' : 'Save'}
          </button>
        )}
      </span>
      {error && <span className="text-[11px] text-red-700 mt-0.5 max-w-[160px]">{error}</span>}
    </span>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, sku, price, quantity, status, metadata, categories(name), product_images(url, position), product_variants(id, name, option2, quantity, price)')
      .order('name');
    if (error) setLoadError('Could not load stock. Refresh the page to try again.');
    setItems((data || []).map(toItem));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const visible = items.filter(i => showArchived || i.status !== 'archived');
  const counts = {
    all: visible.length,
    low: visible.filter(i => i.state === 'low').length,
    out: visible.filter(i => i.state === 'out').length,
    good: visible.filter(i => i.state === 'good').length,
    options: visible.filter(i => i.state !== 'out' && i.soldOutOptions > 0).length,
  };
  const totalUnits = visible.reduce((s, i) => s + i.stock, 0);
  const totalValue = visible.reduce((s, i) => s + i.value, 0);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible.filter(i => {
      if (q && !`${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(q)) return false;
      if (filter === 'all') return true;
      if (filter === 'options') return i.state !== 'out' && i.soldOutOptions > 0;
      return i.state === filter;
    }).sort((a, b) => ({ out: 0, low: 1, good: 2 }[a.state] - { out: 0, low: 1, good: 2 }[b.state]) || a.name.localeCompare(b.name));
  }, [visible, search, filter]);

  const saveStock = async (item: Item, variantId: string | null, quantity: number) => {
    const res = await adminRequest<{ productTotal: number }>('/api/admin/inventory', {
      method: 'PATCH',
      body: JSON.stringify({ productId: item.id, variantId, quantity }),
    });
    setItems(prev => prev.map(p => {
      if (p.id !== item.id) return p;
      const raw = {
        id: p.id, name: p.name, slug: p.slug, sku: p.sku, price: p.price, status: p.status,
        quantity: res.productTotal,
        metadata: { low_stock_threshold: p.threshold, availability: p.preorder ? 'preorder' : undefined },
        categories: p.category ? { name: p.category } : null,
        product_images: p.image ? [{ url: p.image, position: 0 }] : [],
        product_variants: p.variants.map(v => ({ id: v.id, name: v.size || v.color, option2: v.color || null, quantity: v.id === variantId ? quantity : v.quantity, price: v.price })),
      };
      return toItem(raw);
    }));
  };

  const exportCsv = () => {
    const out: unknown[][] = [['Product', 'SKU', 'Category', 'Colour', 'Size', 'Stock', 'Price (GHS)', 'Stock value (GHS)', 'Status']];
    for (const i of rows) {
      if (i.variants.length === 0) {
        out.push([i.name, i.sku, i.category, '', '', i.stock, i.price.toFixed(2), i.value.toFixed(2), i.state]);
      } else {
        for (const v of i.variants) out.push([i.name, i.sku, i.category, v.color, v.size, v.quantity, v.price.toFixed(2), (v.quantity * v.price).toFixed(2), v.quantity === 0 ? 'out' : i.state]);
      }
    }
    downloadCsv(`faithline-stock-${todayStamp()}.csv`, out);
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'out', label: 'Sold out' },
    { key: 'low', label: 'Running low' },
    { key: 'options', label: 'Some options sold out' },
    { key: 'good', label: 'In stock' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600 mt-1 text-sm">Stock for every product, colour and size. Change a number and press Save.</p>
        </div>
        <button type="button" onClick={exportCsv} className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border-2 border-gray-300 text-sm font-semibold text-gray-800 hover:border-gray-400">
          <i className="ri-download-line" aria-hidden="true" /> Export stock (CSV)
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Sold out', value: counts.out, hint: 'Shoppers can’t buy these', tone: counts.out ? 'text-red-700' : 'text-gray-900', icon: 'ri-close-circle-line', f: 'out' as Filter },
          { label: 'Running low', value: counts.low, hint: 'At or below each product’s low-stock level', tone: counts.low ? 'text-amber-700' : 'text-gray-900', icon: 'ri-alert-line', f: 'low' as Filter },
          { label: 'Units in stock', value: totalUnits.toLocaleString('en-GH'), hint: `${counts.all} products`, tone: 'text-gray-900', icon: 'ri-stack-line', f: 'all' as Filter },
          { label: 'Stock value', value: cedi(totalValue), hint: 'At selling price', tone: 'text-gray-900', icon: 'ri-money-dollar-circle-line', f: null },
        ].map(c => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{c.label}</p>
                <i className={`${c.icon} text-xl text-gray-400`} aria-hidden="true" />
              </div>
              <p className={`mt-2 text-2xl md:text-3xl font-bold tabular-nums ${c.tone}`}>{c.value}</p>
              <p className="text-xs text-gray-500 mt-1">{c.hint}</p>
            </>
          );
          return c.f
            ? <button key={c.label} type="button" onClick={() => setFilter(c.f!)} className={`text-left bg-white rounded-xl border p-4 md:p-5 hover:shadow-sm transition-shadow ${filter === c.f && c.f !== 'all' ? 'border-gray-900' : 'border-gray-200'}`}>{body}</button>
            : <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">{body}</div>;
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, SKU or category"
            aria-label="Search stock" className="w-full h-11 pl-9 pr-3 rounded-lg border-2 border-gray-200 focus:border-gray-900 outline-none text-sm" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter stock">
          {FILTERS.map(f => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={`h-9 px-3 rounded-full text-sm font-medium border transition-colors ${filter === f.key ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'}`}>
              {f.label} <span className={`ml-1 tabular-nums ${filter === f.key ? 'text-white/70' : 'text-gray-400'}`}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="w-4 h-4" />
          Show archived
        </label>
      </div>

      {loadError && <div className="p-4 rounded-lg bg-red-50 text-red-800 text-sm border border-red-100" role="alert">{loadError}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-gray-500">Loading stock…</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-gray-500">{search ? 'No products match your search.' : 'Nothing here.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map(item => {
              const isOpen = !!open[item.id];
              const colors = [...new Set(item.variants.map(v => v.color))];
              const sizes = [...new Set(item.variants.map(v => v.size))];
              return (
                <li key={item.id}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="w-12 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <i className="ri-image-line text-gray-300 text-xl w-full h-full flex items-center justify-center" aria-hidden="true" />}
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {[item.category || 'No category', item.sku].filter(Boolean).join(' · ')}
                        {item.status !== 'active' && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">{item.status}</span>}
                        {item.preorder && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#FBF1E6] text-[#8A4B1F]">Pre-order</span>}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      item.state === 'out' ? 'bg-red-50 text-red-700' : item.state === 'low' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                      <i className={item.state === 'out' ? 'ri-close-circle-fill' : item.state === 'low' ? 'ri-alert-fill' : 'ri-checkbox-circle-fill'} aria-hidden="true" />
                      {item.state === 'out' ? 'Sold out' : item.state === 'low' ? `Low (≤${item.threshold})` : 'In stock'}
                    </span>
                    {item.soldOutOptions > 0 && item.state !== 'out' && (
                      <span className="text-xs text-amber-800 whitespace-nowrap">{item.soldOutOptions} option{item.soldOutOptions === 1 ? '' : 's'} sold out</span>
                    )}
                    <div className="flex items-center gap-3 ml-auto">
                      <div className="text-right">
                        <p className="text-[11px] text-gray-500">Value</p>
                        <p className="text-sm font-semibold tabular-nums text-gray-900">{cedi(item.value)}</p>
                      </div>
                      {item.variants.length === 0 ? (
                        <StockInput value={item.stock} label={`Stock for ${item.name}`} onSave={(q) => saveStock(item, null, q)} />
                      ) : (
                        <button type="button" onClick={() => setOpen(o => ({ ...o, [item.id]: !o[item.id] }))} aria-expanded={isOpen}
                          className="h-9 px-3 rounded-lg border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50 whitespace-nowrap tabular-nums">
                          {item.stock} in stock <i className={`ri-arrow-${isOpen ? 'up' : 'down'}-s-line ml-0.5`} aria-hidden="true" />
                        </button>
                      )}
                      <Link href={`/admin/products/${item.id}`} className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100" aria-label={`Edit ${item.name}`} title="Edit product">
                        <i className="ri-edit-line text-lg" aria-hidden="true" />
                      </Link>
                      {item.slug && item.status === 'active' && (
                        <a href={`/product/${item.slug}`} target="_blank" rel="noreferrer" className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100" aria-label={`View ${item.name} on the website`} title="View on website">
                          <i className="ri-external-link-line text-lg" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                  {isOpen && item.variants.length > 0 && (
                    <div className="px-4 pb-4 overflow-x-auto">
                      <table className="text-sm border-separate border-spacing-0">
                        <thead>
                          <tr>
                            <th className="text-left pr-4 py-1.5 font-semibold text-gray-600">{colors.some(Boolean) ? 'Colour' : ''}</th>
                            {sizes.map(s => <th key={s || 'one'} className="px-1.5 py-1.5 font-semibold text-gray-600 text-center">{s || 'Stock'}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {colors.map(c => (
                            <tr key={c || 'one'}>
                              <td className="pr-4 py-1 font-medium text-gray-900 whitespace-nowrap">{c || '—'}</td>
                              {sizes.map(s => {
                                const v = item.variants.find(x => x.color === c && x.size === s);
                                return (
                                  <td key={`${c}-${s}`} className="px-1.5 py-1">
                                    {v ? <StockInput value={v.quantity} label={`Stock for ${item.name} ${[c, s].filter(Boolean).join(' ')}`} onSave={(q) => saveStock(item, v.id, q)} /> : <span className="text-gray-300">—</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
