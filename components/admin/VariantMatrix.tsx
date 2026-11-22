'use client';

import { useRef, useState } from 'react';

type Color = { name: string; hex: string };
type Row = { id?: string; price: string; stock: string; sku: string; image_url?: string };

type Props = {
  colors: Color[];
  /** Already in display order (S, M, L, XL…) */
  sizes: string[];
  data: Record<string, Row>;
  keyOf: (color: string, size: string) => string;
  productPrice: string;
  productImages: { url: string; media_type?: string }[];
  onField: (key: string, field: 'price' | 'stock', value: string) => void;
  onImage: (key: string, url: string) => void;
  onRemoveColor: (color: Color) => void;
  uploadPhoto: (file: File) => Promise<string>;
};

/**
 * Variant editor laid out as a grid: colours down the side, sizes across.
 * One photo per colour (applied to all its sizes), stock typed straight into
 * the grid, quick-fill for a row, a column or everything, and prices that
 * follow the product price unless an option costs more.
 */
export default function VariantMatrix({
  colors, sizes, data, keyOf, productPrice, productImages, onField, onImage, onRemoveColor, uploadPhoto,
}: Props) {
  const rows: Color[] = colors.length > 0 ? colors : [{ name: '', hex: '' }];
  const cols: string[] = sizes.length > 0 ? sizes : [''];
  const cell = (color: string, size: string) => data[keyOf(color, size)] || { price: '', stock: '0', sku: '' };
  const num = (v: string) => Math.max(0, parseInt(v, 10) || 0);

  const hasCustomPrice = rows.some(r => cols.some(c => {
    const p = cell(r.name, c).price;
    return p !== '' && Number(p) !== Number(productPrice);
  }));
  const [showPrices, setShowPrices] = useState(hasCustomPrice);
  const [fillAll, setFillAll] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const photos = productImages.filter(img => img.media_type !== 'video');
  const total = rows.reduce((s, r) => s + cols.reduce((t, c) => t + num(cell(r.name, c).stock), 0), 0);

  const setRow = (color: string, field: 'price' | 'stock', value: string) =>
    cols.forEach(c => onField(keyOf(color, c), field, value));
  const setCol = (size: string, field: 'price' | 'stock', value: string) =>
    rows.forEach(r => onField(keyOf(r.name, size), field, value));
  const setAll = (field: 'price' | 'stock', value: string) =>
    rows.forEach(r => cols.forEach(c => onField(keyOf(r.name, c), field, value)));

  /** The colour's photo (the one most of its sizes use) and whether every size has it. */
  const colorPhoto = (color: string): { url: string; partial: boolean } => {
    const counts = new Map<string, number>();
    cols.forEach(c => { const u = cell(color, c).image_url || ''; if (u) counts.set(u, (counts.get(u) || 0) + 1); });
    const [url = '', n = 0] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    return { url, partial: !!url && n < cols.length };
  };
  const setColorPhoto = (color: string, url: string) => cols.forEach(c => onImage(keyOf(color, c), url));

  // Enter moves down the column, like a spreadsheet
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = Array.from(gridRef.current?.querySelectorAll<HTMLInputElement>('input[data-cell]') || []);
    const me = e.currentTarget;
    const [grid, r, c] = (me.dataset.cell || '').split(':');
    const next = inputs.find(i => i.dataset.cell === `${grid}:${Number(r) + 1}:${c}`)
      || inputs.find(i => i.dataset.cell === `${grid}:0:${Number(c) + 1}`);
    next?.focus();
    next?.select();
  };

  const grid = (field: 'price' | 'stock') => (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white z-10 text-left py-2 pr-4 font-semibold text-gray-700 min-w-[150px]">
              {colors.length > 0 ? 'Colour' : ''}
            </th>
            {cols.map((size) => (
              <th key={size || 'one'} className="px-1.5 py-2 font-semibold text-gray-700 text-center min-w-[78px]">
                <span className="block">{size || (field === 'stock' ? 'Stock' : 'Price')}</span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCol(size, field, cell(rows[0].name, size)[field])}
                    className="mt-1 text-[11px] font-medium text-brand-brown hover:underline"
                    title={`Copy the ${rows[0].name || 'first'} value to every colour in ${size || 'this column'}`}
                  >
                    Fill ↓
                  </button>
                )}
              </th>
            ))}
            {cols.length > 1 && field === 'stock' && (
              <th className="px-3 py-2 font-semibold text-gray-500 text-right">Total</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const rowTotal = cols.reduce((t, c) => t + num(cell(r.name, c).stock), 0);
            return (
              <tr key={r.name || 'one'}>
                <td className="sticky left-0 bg-white z-10 py-1.5 pr-4">
                  <div className="flex items-center gap-2">
                    {r.name && <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: r.hex }} aria-hidden="true" />}
                    <span className="font-medium text-gray-900 truncate max-w-[110px]" title={r.name}>{r.name || (field === 'stock' ? 'Stock' : 'Price')}</span>
                    {cols.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRow(r.name, field, cell(r.name, cols[0])[field])}
                        className="ml-auto text-[11px] font-medium text-brand-brown hover:underline whitespace-nowrap"
                        title={`Copy the ${cols[0]} value to every size of ${r.name || 'this row'}`}
                      >
                        Fill →
                      </button>
                    )}
                  </div>
                  {field === 'stock' && r.name && rowTotal === 0 && (
                    <p className="text-[11px] text-amber-700 mt-0.5">No stock in any size</p>
                  )}
                </td>
                {cols.map((size, ci) => {
                  const key = keyOf(r.name, size);
                  const v = cell(r.name, size)[field];
                  const custom = field === 'price' && v !== '' && Number(v) !== Number(productPrice);
                  return (
                    <td key={key} className="px-1.5 py-1.5">
                      <input
                        type="number"
                        inputMode={field === 'stock' ? 'numeric' : 'decimal'}
                        min={0}
                        step={field === 'price' ? '0.01' : '1'}
                        aria-label={`${field === 'stock' ? 'Stock' : 'Price'} for ${[r.name, size].filter(Boolean).join(' ')}`}
                        data-cell={`${field}:${ri}:${ci}`}
                        value={field === 'stock' && v === '0' ? '' : v}
                        placeholder={field === 'price' ? (productPrice || '0') : '0'}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={onKeyDown}
                        onChange={(e) => onField(key, field, field === 'stock' ? (e.target.value === '' ? '0' : e.target.value) : e.target.value)}
                        className={`w-[72px] h-10 px-2 text-center rounded-lg border tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-brown/40 focus:border-brand-brown ${
                          field === 'stock' && num(v) > 0 ? 'border-gray-300 bg-white font-semibold text-gray-900'
                            : custom ? 'border-brand-brown/50 bg-brand-cream font-semibold text-gray-900'
                            : 'border-gray-200 bg-gray-50 text-gray-500'
                        }`}
                      />
                    </td>
                  );
                })}
                {cols.length > 1 && field === 'stock' && (
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-700">{rowTotal}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4" ref={gridRef}>
      {/* Photos: one per colour */}
      {colors.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h4 className="text-sm font-bold text-gray-900">Step 3: A photo for each colour</h4>
            <p className="text-xs text-gray-500">Used for every size of that colour</p>
          </div>
          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {colors.map(color => {
              const { url: photo, partial } = colorPhoto(color.name);
              const busy = uploading === color.name;
              return (
                <div key={color.name} className="rounded-xl border border-gray-200 p-2.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hex }} aria-hidden="true" />
                    <span className="text-sm font-semibold text-gray-900 truncate" title={color.name}>{color.name}</span>
                    <button
                      type="button"
                      onClick={() => { if (confirm(`Remove ${color.name} and all its sizes from this product?`)) onRemoveColor(color); }}
                      className="ml-auto w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${color.name}`}
                    >
                      <i className="ri-delete-bin-line" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="aspect-[4/5] rounded-lg bg-gray-50 border border-dashed border-gray-200 overflow-hidden flex items-center justify-center">
                    {photo ? (
                      <img src={photo} alt={color.name} className="w-full h-full object-cover object-top" />
                    ) : (
                      <span className="text-xs text-gray-400 flex flex-col items-center gap-1"><i className="ri-image-line text-xl" aria-hidden="true" />No photo</span>
                    )}
                  </div>
                  {partial && (
                    <button type="button" onClick={() => setColorPhoto(color.name, photo)} className="text-[11px] leading-tight text-amber-800 bg-amber-50 rounded-md px-2 py-1 text-left hover:bg-amber-100">
                      Only on some sizes. <span className="font-semibold underline">Use for all</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <label className={`flex-1 h-9 inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 text-xs font-semibold text-gray-800 hover:bg-gray-50 cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                      <i className={busy ? 'ri-loader-4-line animate-spin' : 'ri-upload-2-line'} aria-hidden="true" />
                      {busy ? 'Uploading…' : photo ? 'Change' : 'Upload'}
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          setUploading(color.name);
                          try {
                            setColorPhoto(color.name, await uploadPhoto(file));
                          } catch (err: any) {
                            alert(`Could not upload the photo: ${err.message}`);
                          } finally {
                            setUploading(null);
                          }
                        }}
                      />
                    </label>
                    {photo && (
                      <button type="button" onClick={() => setColorPhoto(color.name, '')} className="h-9 px-2 text-xs font-medium text-gray-500 hover:text-red-600">
                        Remove
                      </button>
                    )}
                  </div>
                  {photos.length > 0 && (
                    <select
                      className="h-9 text-xs border border-gray-300 rounded-lg px-2 text-gray-700 bg-white"
                      value=""
                      aria-label={`Use a product photo for ${color.name}`}
                      onChange={(e) => { if (e.target.value) setColorPhoto(color.name, e.target.value); }}
                    >
                      <option value="">Use a product photo…</option>
                      {photos.map((img, i) => <option key={img.url} value={img.url}>Photo {i + 1}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h4 className="text-sm font-bold text-gray-900">{colors.length > 0 ? 'Step 4' : 'Step 3'}: Stock</h4>
            <p className="text-xs text-gray-500">Type the number in stock. Enter moves down. “Fill” copies the first box along the row or column.</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="fill-all-stock" className="text-xs font-medium text-gray-600">Same for all</label>
            <input
              id="fill-all-stock"
              type="number"
              min={0}
              inputMode="numeric"
              value={fillAll}
              onChange={(e) => setFillAll(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && fillAll !== '') { e.preventDefault(); setAll('stock', String(num(fillAll))); setFillAll(''); } }}
              placeholder="0"
              className="w-16 h-9 px-2 text-center rounded-lg border border-gray-300 text-sm"
            />
            <button
              type="button"
              disabled={fillAll === ''}
              onClick={() => { setAll('stock', String(num(fillAll))); setFillAll(''); }}
              className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
        {grid('stock')}
        <p className="mt-3 text-xs text-gray-700">Total in stock: <strong className="tabular-nums">{total}</strong></p>
      </div>

      {/* Prices */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-gray-900">Price</h4>
            <p className="text-xs text-gray-500">
              {showPrices
                ? `Leave a box empty to use the product price (₵${productPrice || '0'}).`
                : `Every option sells at the product price, ₵${productPrice || '0'}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (showPrices && hasCustomPrice) {
                if (!confirm('Use the product price for every option again?')) return;
                setAll('price', '');
              }
              setShowPrices(!showPrices);
            }}
            className="h-9 px-3 rounded-lg border border-gray-300 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            aria-expanded={showPrices}
          >
            {showPrices ? 'Same price for all' : 'Some options cost more'}
          </button>
        </div>
        {showPrices && <div className="mt-3">{grid('price')}</div>}
      </div>
    </div>
  );
}
