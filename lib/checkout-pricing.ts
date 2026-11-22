import { supabaseAdmin } from '@/lib/supabase-admin';
import { computeCartBundles, parseBundleTiers } from '@/lib/bundle-pricing';
import { computeCouponDiscount, type AppliedCoupon } from '@/lib/coupons';

/**
 * Server-side pricing for checkout. Prices, variant prices, bundle tiers,
 * stock and minimum order quantities always come from the database: the
 * browser only says which product, which option and how many.
 */

export type CheckoutLineInput = {
  productId: string;
  variantId?: string | null;
  /** "Colour / Size", "Size" or "Colour" — used when an older cart has no variantId */
  variantLabel?: string | null;
  quantity: number;
};

export type PricedLine = {
  productId: string;
  productName: string;
  slug: string;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  image: string | null;
  preorderShipping: string | null;
};

export type PricingIssue = { productId: string; variantLabel?: string | null; message: string };

export type PricedCart = {
  lines: PricedLine[];
  /** Sum of unit price × quantity (what order lines add up to) */
  baseSubtotal: number;
  /** After bundle deals */
  bundledSubtotal: number;
  bundleSavings: number;
  coupon: AppliedCoupon | null;
  couponDiscount: number;
  freeShipping: boolean;
  total: number;
};

const money = (n: number) => Math.round(n * 100) / 100;

function variantLabelOf(v: { name?: string | null; option2?: string | null }): string | null {
  const color = (v.option2 || '').trim();
  const size = (v.name || '').trim();
  if (color && size && color !== size) return `${color} / ${size}`;
  return color || size || null;
}

function findVariant(variants: any[], input: CheckoutLineInput): any | null {
  if (input.variantId) {
    const byId = variants.find(v => v.id === input.variantId);
    if (byId) return byId;
  }
  const label = (input.variantLabel || '').trim();
  if (!label) return null;
  const [a, b] = label.split(' / ').map(s => s.trim());
  const eq = (x: unknown, y: string) => String(x || '').trim().toLowerCase() === y.toLowerCase();
  if (b !== undefined) {
    return variants.find(v => eq(v.option2, a) && eq(v.name, b))
      || variants.find(v => eq(v.name, a) && eq(v.option2, b)) // "Size / Colour"
      || null;
  }
  return variants.find(v => eq(v.name, a) || eq(v.option2, a)) || null;
}

/** Look a coupon up by its exact code (case-insensitive) and check it applies. */
export async function validateCoupon(
  rawCode: string,
  subtotal: number
): Promise<{ coupon: AppliedCoupon } | { error: string }> {
  const code = rawCode.trim();
  if (!code) return { error: 'Enter a coupon code.' };
  const escaped = code.replace(/[\\%_]/g, m => `\\${m}`);
  const { data: c, error } = await supabaseAdmin
    .from('coupons')
    .select('code, description, type, value, minimum_purchase, maximum_discount, usage_limit, usage_count, start_date, end_date, is_active')
    .ilike('code', escaped)
    .maybeSingle();
  if (error) return { error: 'Could not check the coupon. Please try again.' };
  if (!c || !c.is_active) return { error: 'That coupon code isn’t valid.' };
  const now = new Date();
  if (c.start_date && new Date(c.start_date) > now) return { error: 'This coupon isn’t active yet.' };
  if (c.end_date && new Date(c.end_date) < now) return { error: 'This coupon has expired.' };
  if (c.usage_limit != null && (c.usage_count || 0) >= c.usage_limit) return { error: 'This coupon has been fully used.' };
  const minPurchase = Number(c.minimum_purchase) || 0;
  if (minPurchase > 0 && subtotal < minPurchase) {
    return { error: `This coupon needs a minimum spend of ₵${minPurchase.toFixed(2)} (add ₵${(minPurchase - subtotal).toFixed(2)} more).` };
  }
  const coupon: AppliedCoupon = {
    code: c.code,
    description: c.description || '',
    type: c.type,
    value: Number(c.value) || 0,
    minPurchase,
    maxDiscount: c.maximum_discount != null ? Number(c.maximum_discount) : null,
  };
  if (coupon.type !== 'free_shipping' && computeCouponDiscount(coupon, subtotal) <= 0) {
    return { error: 'This coupon gives no discount on your bag.' };
  }
  return { coupon };
}

export async function priceCart(
  inputs: CheckoutLineInput[],
  couponCode?: string | null
): Promise<{ priced: PricedCart; issues: PricingIssue[] }> {
  const issues: PricingIssue[] = [];
  const cleanInputs = inputs
    .filter(i => i && typeof i.productId === 'string')
    .map(i => ({ ...i, quantity: Math.max(0, Math.floor(Number(i.quantity) || 0)) }))
    .filter(i => i.quantity > 0);

  const ids = Array.from(new Set(cleanInputs.map(i => i.productId)));
  const { data: products, error } = ids.length
    ? await supabaseAdmin
        .from('products')
        .select('id, name, slug, price, quantity, moq, status, metadata, product_images(url, position), product_variants(id, name, option2, price, quantity, image_url)')
        .in('id', ids)
    : { data: [], error: null };
  if (error) throw new Error(`Could not load products: ${error.message}`);
  const byId = new Map<string, any>((products || []).map((p: any) => [p.id, { ...p, name: String(p.name || '').trim() }]));

  const lines: PricedLine[] = [];
  const demand = new Map<string, number>(); // stock key → quantity requested

  for (const input of cleanInputs) {
    const p: any = byId.get(input.productId);
    if (!p || p.status !== 'active') {
      issues.push({ productId: input.productId, variantLabel: input.variantLabel, message: 'This item is no longer available.' });
      continue;
    }
    const variants: any[] = p.product_variants || [];
    let variant: any = null;
    if (variants.length > 0) {
      variant = findVariant(variants, input);
      if (!variant) {
        issues.push({ productId: p.id, variantLabel: input.variantLabel, message: `Choose a size or colour for ${p.name}.` });
        continue;
      }
    }
    const unitPrice = variant && Number(variant.price) > 0 ? Number(variant.price) : Number(p.price) || 0;
    if (unitPrice <= 0) {
      issues.push({ productId: p.id, variantLabel: input.variantLabel, message: `${p.name} has no price yet. Please contact us.` });
      continue;
    }
    const tracksVariantStock = variants.some(v => (Number(v.quantity) || 0) > 0);
    const stockKey = variant && tracksVariantStock ? `v:${variant.id}` : `p:${p.id}`;
    // Pre-order products are sold ahead of stock arriving
    if (p.metadata?.availability !== 'preorder') demand.set(stockKey, (demand.get(stockKey) || 0) + input.quantity);

    const image = (variant?.image_url as string) ||
      [...(p.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url || null;
    lines.push({
      productId: p.id,
      productName: p.name,
      slug: p.slug,
      variantId: variant?.id ?? null,
      variantLabel: variant ? variantLabelOf(variant) : null,
      quantity: input.quantity,
      unitPrice,
      image,
      preorderShipping: p.metadata?.preorder_shipping || null,
    });
  }

  // Stock: per variant when variants carry stock, otherwise per product
  for (const [key, wanted] of demand) {
    const [kind, id] = key.split(':');
    let available = 0;
    let label = '';
    let productId = '';
    if (kind === 'v') {
      for (const p of byId.values()) {
        const v = (p.product_variants || []).find((x: any) => x.id === id);
        if (v) { available = Number(v.quantity) || 0; label = variantLabelOf(v) || ''; productId = p.id; break; }
      }
    } else {
      const p: any = byId.get(id);
      available = Number(p?.quantity) || 0;
      productId = id;
    }
    if (wanted > available) {
      const name = byId.get(productId)?.name || 'This item';
      issues.push({
        productId,
        variantLabel: label || null,
        message: available > 0
          ? `Only ${available} left of ${name}${label ? ` (${label})` : ''}.`
          : `${name}${label ? ` (${label})` : ''} is sold out.`,
      });
    }
  }

  // Minimum order quantity per product
  const qtyByProduct = new Map<string, number>();
  for (const l of lines) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) || 0) + l.quantity);
  for (const [pid, qty] of qtyByProduct) {
    const moq = Number(byId.get(pid)?.moq) || 1;
    if (qty < moq) issues.push({ productId: pid, message: `${byId.get(pid)?.name} has a minimum order of ${moq}.` });
  }

  const bundle = computeCartBundles(lines.map(l => ({
    productId: l.productId,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    tiers: parseBundleTiers(byId.get(l.productId)?.metadata?.bundle_pricing),
  })));

  let coupon: AppliedCoupon | null = null;
  let couponDiscount = 0;
  if (couponCode && couponCode.trim()) {
    const result = await validateCoupon(couponCode, bundle.bundledSubtotal);
    if ('error' in result) issues.push({ productId: '', message: result.error });
    else {
      coupon = result.coupon;
      couponDiscount = computeCouponDiscount(coupon, bundle.bundledSubtotal);
    }
  }

  return {
    issues,
    priced: {
      lines,
      baseSubtotal: bundle.baseSubtotal,
      bundledSubtotal: bundle.bundledSubtotal,
      bundleSavings: bundle.savings,
      coupon,
      couponDiscount: money(couponDiscount),
      freeShipping: coupon?.type === 'free_shipping',
      total: money(Math.max(0, bundle.bundledSubtotal - couponDiscount)),
    },
  };
}
