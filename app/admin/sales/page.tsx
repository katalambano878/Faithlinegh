'use client';

import { Fragment, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300?text=No+Image';
const PAGE_SIZE = 24;

interface SaleProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  on_sale: boolean;
  status: string;
  metadata: any;
  category: string;
  variantCount: number;
  image: string;
}

interface SaleVariant {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  option1: string | null;
  option2: string | null;
  metadata: any;
}

/**
 * Mirror of the SQL "derived regular price" formula, plus awareness of the
 * paused state (metadata.paused_sale_price holds the sale price while the
 * master switch is off).
 */
function derivePricing(row: { price: number; compare_at_price: number | null; metadata: any }) {
  const paused = row.metadata?.paused_sale_price;
  if (paused !== undefined && paused !== null && Number(paused) > 0) {
    return { regular: Number(row.price), sale: Number(paused), paused: true };
  }
  if (row.compare_at_price !== null && Number(row.compare_at_price) > Number(row.price)) {
    return { regular: Number(row.compare_at_price), sale: Number(row.price), paused: false };
  }
  return { regular: Number(row.price), sale: null as number | null, paused: false };
}

function pctOff(regular: number, sale: number | null): number | null {
  if (sale === null || regular <= 0 || sale >= regular) return null;
  return Math.round((1 - sale / regular) * 100);
}

const money = (n: number) => `₵${n.toFixed(2)}`;

export default function AdminSalesPage() {
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesActive, setSalesActive] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [busy, setBusy] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [saleFilter, setSaleFilter] = useState<'all' | 'on_sale' | 'not_on_sale'>('all');
  const [page, setPage] = useState(1);

  // Selection + bulk inputs
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pctInput, setPctInput] = useState('');
  const [fixedInput, setFixedInput] = useState('');

  // Per-row quick fixed price inputs
  const [rowPrice, setRowPrice] = useState<Record<string, string>>({});

  // Variant expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [variants, setVariants] = useState<SaleVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantPrices, setVariantPrices] = useState<Record<string, string>>({});
  const [fillAllInput, setFillAllInput] = useState('');

  // Toast
  const [toast, setToast] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const showToast = useCallback((text: string, kind: 'success' | 'error' = 'success') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sales', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSalesActive(data.active !== false);
      }
    } catch (err) {
      console.error('Failed to load sales status:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const all: any[] = [];
      const CHUNK = 1000;
      for (let from = 0; ; from += CHUNK) {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id, name, slug, price, compare_at_price, on_sale, status, metadata,
            categories(name),
            product_variants(count),
            product_images(url, position)
          `)
          .order('created_at', { ascending: false })
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < CHUNK) break;
      }
      const mapped: SaleProduct[] = all.map((p: any) => {
        const images = (p.product_images || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          compare_at_price: p.compare_at_price !== null ? Number(p.compare_at_price) : null,
          on_sale: !!p.on_sale,
          status: p.status,
          metadata: p.metadata || {},
          category: p.categories?.name || '—',
          variantCount: p.product_variants?.[0]?.count ?? 0,
          image: images[0]?.url || PLACEHOLDER_IMAGE,
        };
      });
      setProducts(mapped);
      setCategories(Array.from(new Set(mapped.map((p) => p.category).filter((c) => c !== '—'))).sort());
    } catch (err) {
      console.error('Failed to load products:', err);
      showToast('Failed to load products', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchProducts()]);
      setLoading(false);
    })();
  }, [fetchStatus, fetchProducts]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchProducts()]);
    if (expandedId) await loadVariants(expandedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStatus, fetchProducts, expandedId]);

  // ── API helpers ─────────────────────────────────────────────────────────

  async function postAction(payload: any): Promise<any | null> {
    const res = await fetch('/api/admin/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Request failed', 'error');
      return null;
    }
    return data;
  }

  const handleToggleActive = async () => {
    if (switching) return;
    const next = !salesActive;
    const label = next ? 'resume' : 'pause';
    if (!confirm(`This will ${label} ALL sales storewide. Continue?`)) return;
    setSwitching(true);
    const data = await postAction({ action: 'set_active', active: next });
    if (data) {
      const c = data.counts || {};
      showToast(
        next
          ? `Sales resumed — ${c.products ?? 0} products, ${c.variants ?? 0} variants restored to sale prices`
          : `Sales paused — ${c.products ?? 0} products, ${c.variants ?? 0} variants back to regular prices`
      );
      await refresh();
    }
    setSwitching(false);
  };

  const handleApplyPct = async () => {
    const pct = Number(pctInput);
    if (!Number.isFinite(pct) || pct < 1 || pct > 99) {
      showToast('Enter a percentage between 1 and 99', 'error');
      return;
    }
    setBusy(true);
    const data = await postAction({ action: 'apply', mode: 'percentage', value: pct, productIds: Array.from(selected) });
    if (data) {
      const c = data.counts || {};
      showToast(`Applied ${pct}% off to ${c.products ?? 0} products (${c.variants ?? 0} variants)`);
      setSelected(new Set());
      await refresh();
    }
    setBusy(false);
  };

  const handleApplyFixed = async (ids: string[], value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Enter a sale price greater than 0', 'error');
      return;
    }
    setBusy(true);
    const data = await postAction({ action: 'apply', mode: 'fixed', value, productIds: ids });
    if (data) {
      const c = data.counts || {};
      let msg = `Set ${money(value)} on ${c.products ?? 0} product(s)`;
      if (data.note) msg += ` — ${data.note}`;
      showToast(msg, (c.products ?? 0) > 0 ? 'success' : 'error');
      setSelected(new Set());
      await refresh();
    }
    setBusy(false);
  };

  const handleRemoveSale = async () => {
    if (!confirm(`Remove sale from ${selected.size} selected product(s)? Prices go back to regular.`)) return;
    setBusy(true);
    const data = await postAction({ action: 'remove', productIds: Array.from(selected) });
    if (data) {
      const c = data.counts || {};
      showToast(`Sale removed from ${c.products ?? 0} products (${c.variants ?? 0} variants restored)`);
      setSelected(new Set());
      await refresh();
    }
    setBusy(false);
  };

  // ── Variants ────────────────────────────────────────────────────────────

  const loadVariants = async (productId: string) => {
    setVariantsLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, name, price, compare_at_price, option1, option2, metadata')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const rows: SaleVariant[] = (data || []).map((v: any) => ({
        ...v,
        price: Number(v.price),
        compare_at_price: v.compare_at_price !== null ? Number(v.compare_at_price) : null,
        metadata: v.metadata || {},
      }));
      setVariants(rows);
      const inputs: Record<string, string> = {};
      for (const v of rows) {
        const { sale } = derivePricing(v);
        inputs[v.id] = sale !== null ? String(sale) : '';
      }
      setVariantPrices(inputs);
    } catch (err) {
      console.error('Failed to load variants:', err);
      showToast('Failed to load variants', 'error');
    } finally {
      setVariantsLoading(false);
    }
  };

  const toggleExpand = async (productId: string) => {
    if (expandedId === productId) {
      setExpandedId(null);
      setVariants([]);
      return;
    }
    setExpandedId(productId);
    setVariants([]);
    setFillAllInput('');
    await loadVariants(productId);
  };

  const handleApplyVariantPrices = async () => {
    const items = Object.entries(variantPrices)
      .map(([variantId, val]) => ({ variantId, price: Number(val) }))
      .filter((i) => Number.isFinite(i.price) && i.price > 0);
    if (items.length === 0) {
      showToast('Enter at least one variant sale price', 'error');
      return;
    }
    setBusy(true);
    const data = await postAction({ action: 'variant_prices', items });
    if (data) {
      const c = data.counts || {};
      let msg = `Updated ${c.variants ?? 0} variant(s)`;
      if (data.note) msg += ` — ${data.note}`;
      showToast(msg, (c.variants ?? 0) > 0 ? 'success' : 'error');
      await refresh();
    }
    setBusy(false);
  };

  // ── Derived view data ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    const onSale = products.filter((p) => p.on_sale).length;
    return { total: products.length, onSale, notOnSale: products.length - onSale };
  }, [products]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (saleFilter === 'on_sale' && !p.on_sale) return false;
      if (saleFilter === 'not_on_sale' && p.on_sale) return false;
      return true;
    });
  }, [products, search, categoryFilter, saleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, saleFilter]);

  const allPageSelected = pageRows.length > 0 && pageRows.every((p) => selected.has(p.id));
  const toggleSelectAllPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageRows.forEach((p) => next.delete(p.id));
      else pageRows.forEach((p) => next.add(p.id));
      return next;
    });
  };
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const editingDisabled = !salesActive || busy;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 max-w-md rounded-xl px-5 py-4 text-sm font-medium text-white shadow-xl ${
            toast.kind === 'success' ? 'bg-green-700' : 'bg-red-600'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-600 mt-1">
            Put products on sale in bulk. Pick items, set a discount % or a fixed price, and apply.
          </p>
        </div>
        <Link
          href="/sale"
          target="_blank"
          className="inline-flex items-center px-5 py-3 bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-50 rounded-lg font-semibold transition-colors whitespace-nowrap"
        >
          <i className="ri-external-link-line mr-2" />
          View Sale page
        </Link>
      </div>

      {/* Master switch banner */}
      <div
        className={`rounded-xl border-2 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          salesActive ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-white ${
              salesActive ? 'bg-green-600' : 'bg-gray-500'
            }`}
          >
            <i className={salesActive ? 'ri-flashlight-fill' : 'ri-pause-fill'} />
          </span>
          <div>
            <p className="font-bold text-gray-900">
              Sales are currently {salesActive ? 'ON' : 'OFF'}
            </p>
            <p className="text-sm text-gray-600">
              {salesActive
                ? 'Discounted prices and badges are live on the storefront.'
                : 'All products show regular prices. Sale configuration is saved and will restore when turned back on.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleActive}
          disabled={switching}
          className={`px-6 py-3 rounded-lg font-semibold text-white whitespace-nowrap transition-colors disabled:opacity-50 ${
            salesActive ? 'bg-gray-700 hover:bg-gray-900' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {switching ? 'Working…' : salesActive ? 'Turn sales OFF' : 'Turn sales ON'}
        </button>
      </div>

      {!salesActive && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4 text-amber-900 flex items-center gap-3">
          <i className="ri-alert-line text-xl" />
          <p className="text-sm font-medium">
            Editing is disabled while sales are off. Turn sales on to change discounts.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total products</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">On sale</p>
          <p className="text-2xl font-bold text-green-700">{stats.onSale}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Not on sale</p>
          <p className="text-2xl font-bold text-gray-900">{stats.notOnSale}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Filters */}
        <div className="p-6 border-b border-gray-200 flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1 max-w-md">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name…"
              className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg text-sm cursor-pointer"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex border-2 border-gray-300 rounded-lg overflow-hidden text-sm font-medium">
            {([
              ['all', 'All'],
              ['on_sale', 'On sale'],
              ['not_on_sale', 'Not on sale'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSaleFilter(key)}
                className={`px-4 py-3 transition-colors ${
                  saleFilter === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3">
            <p className="font-semibold text-gray-800 mr-2">{selected.size} selected</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={99}
                value={pctInput}
                onChange={(e) => setPctInput(e.target.value)}
                placeholder="% off"
                disabled={editingDisabled}
                className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
              />
              <button
                onClick={handleApplyPct}
                disabled={editingDisabled}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap"
              >
                Apply %
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={fixedInput}
                onChange={(e) => setFixedInput(e.target.value)}
                placeholder="Fixed ₵"
                disabled={editingDisabled}
                className="w-28 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
              />
              <button
                onClick={() => handleApplyFixed(Array.from(selected), Number(fixedInput))}
                disabled={editingDisabled}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap"
              >
                Apply fixed
              </button>
            </div>
            <button
              onClick={handleRemoveSale}
              disabled={editingDisabled}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap"
            >
              Remove sale
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <i className="ri-loader-4-line animate-spin text-3xl mb-2 inline-block" />
            <p>Loading products…</p>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <i className="ri-price-tag-3-line text-4xl mb-4 text-gray-300 inline-block" />
            <p className="text-lg">No products match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-4 px-6 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAllPage}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Product</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">Regular</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">Sale price</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">Off</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Set price</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => {
                  const { regular, sale, paused } = derivePricing(p);
                  const off = pctOff(regular, sale);
                  const isExpanded = expandedId === p.id;
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6">
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3 min-w-[220px]">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                              <img
                                src={p.image}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500">{p.category}</span>
                                {p.status === 'draft' && (
                                  <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-semibold uppercase">Draft</span>
                                )}
                                {p.on_sale && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${paused ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                                    {paused ? 'Sale paused' : 'On sale'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-medium text-gray-900 whitespace-nowrap">
                          {money(regular)}
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          {sale !== null ? (
                            <span className={`font-bold ${paused ? 'text-amber-700' : 'text-green-700'}`}>{money(sale)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          {off !== null ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">-{off}%</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {p.variantCount > 0 ? (
                            <button
                              onClick={() => toggleExpand(p.id)}
                              className="inline-flex items-center gap-1 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-500 whitespace-nowrap"
                            >
                              <i className={isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
                              {p.variantCount} variant{p.variantCount > 1 ? 's' : ''}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0.01}
                                step="0.01"
                                value={rowPrice[p.id] ?? ''}
                                onChange={(e) => setRowPrice((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                placeholder="₵ sale price"
                                disabled={editingDisabled}
                                className="w-28 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                              />
                              <button
                                onClick={() => handleApplyFixed([p.id], Number(rowPrice[p.id]))}
                                disabled={editingDisabled || !rowPrice[p.id]}
                                className="px-3 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-40"
                              >
                                Set
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-gray-100 bg-gray-50/70">
                          <td colSpan={6} className="px-6 py-5">
                            {variantsLoading ? (
                              <p className="text-sm text-gray-500">
                                <i className="ri-loader-4-line animate-spin mr-2 inline-block" />
                                Loading variants…
                              </p>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="number"
                                    min={0.01}
                                    step="0.01"
                                    value={fillAllInput}
                                    onChange={(e) => setFillAllInput(e.target.value)}
                                    placeholder="₵ price for all"
                                    disabled={editingDisabled}
                                    className="w-32 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                                  />
                                  <button
                                    onClick={() => {
                                      if (!fillAllInput) return;
                                      setVariantPrices((prev) => {
                                        const next = { ...prev };
                                        variants.forEach((v) => { next[v.id] = fillAllInput; });
                                        return next;
                                      });
                                    }}
                                    disabled={editingDisabled}
                                    className="px-3 py-2 border-2 border-gray-400 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-600 disabled:opacity-40"
                                  >
                                    Fill all
                                  </button>
                                  <button
                                    onClick={handleApplyVariantPrices}
                                    disabled={editingDisabled}
                                    className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-40"
                                  >
                                    Apply variant sale prices
                                  </button>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {variants.map((v) => {
                                    const vp = derivePricing(v);
                                    const label = [v.option1, v.option2].filter(Boolean).join(' / ') || v.name;
                                    return (
                                      <div key={v.id} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
                                          <p className="text-xs text-gray-500">
                                            Regular {money(vp.regular)}
                                            {vp.sale !== null && (
                                              <span className={vp.paused ? 'text-amber-700' : 'text-green-700'}>
                                                {' '}• Sale {money(vp.sale)}{vp.paused ? ' (paused)' : ''}
                                              </span>
                                            )}
                                          </p>
                                        </div>
                                        <input
                                          type="number"
                                          min={0.01}
                                          step="0.01"
                                          value={variantPrices[v.id] ?? ''}
                                          onChange={(e) => setVariantPrices((prev) => ({ ...prev, [v.id]: e.target.value }))}
                                          placeholder="₵"
                                          disabled={editingDisabled}
                                          className="w-24 px-2 py-1.5 border-2 border-gray-300 rounded-lg text-sm disabled:bg-gray-100 shrink-0"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-sm text-gray-600">{safePage} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

