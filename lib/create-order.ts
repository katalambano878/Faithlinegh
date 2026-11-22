import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { priceCart, type CheckoutLineInput, type PricingIssue } from '@/lib/checkout-pricing';

/**
 * Creates a storefront order (website checkout and the website chat).
 * Callers pass only what was chosen; every price, bundle deal, coupon and
 * stock check is done here from the database, and the order + items are
 * written with the service role.
 */

export type DeliveryMethod = 'pickup' | 'doorstep' | 'outside_accra';
export const DELIVERY_METHODS: DeliveryMethod[] = ['pickup', 'doorstep', 'outside_accra'];

export type CreateOrderInput = {
  items: CheckoutLineInput[];
  contact: { fullName?: string; email?: string; phone?: string };
  delivery: { method?: string; area?: string; street?: string; gps?: string; region?: string };
  paymentChannel?: string;
  couponCode?: string | null;
  userId?: string | null;
  saveAddress?: boolean;
  source?: 'web' | 'chat';
};

export type CreateOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      accessToken: string;
      total: number;
      subtotal: number;
      bundleSavings: number;
      couponDiscount: number;
      deliveryFeePending: boolean;
      lines: { productName: string; variantLabel: string | null; quantity: number; unitPrice: number }[];
    }
  | { ok: false; status: number; error: string; fieldErrors?: Record<string, string>; issues?: PricingIssue[] };

export function normalizeGhanaPhone(raw: string): string | null {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('233')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^\d{9}$/.test(digits) ? `+233${digits}` : null;
}

const clean = (v: unknown, max = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export async function createStorefrontOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const userId = input.userId || null;
  const items: CheckoutLineInput[] = Array.isArray(input.items) ? input.items.slice(0, 50) : [];
  if (items.length === 0) return { ok: false, status: 400, error: 'Your bag is empty.' };

  const phone = normalizeGhanaPhone(input.contact?.phone || '');
  const fullName = clean(input.contact?.fullName, 120);
  const email = clean(input.contact?.email, 160).toLowerCase();
  const method = DELIVERY_METHODS.includes(input.delivery?.method as DeliveryMethod) ? (input.delivery.method as DeliveryMethod) : null;
  const paymentChannel = input.paymentChannel === 'card' ? 'card' : 'momo';
  const fieldErrors: Record<string, string> = {};
  if (!phone) fieldErrors.phone = 'Enter your phone number, for example 024 123 4567.';
  if (fullName.length < 2) fieldErrors.fullName = 'Enter your full name.';
  if (!/^\S+@\S+\.\S+$/.test(email)) fieldErrors.email = 'Check your email address.';
  if (!method) fieldErrors.delivery = 'Choose pickup or delivery.';
  const area = clean(input.delivery?.area, 120);
  const street = clean(input.delivery?.street, 240);
  const gps = clean(input.delivery?.gps, 30).toUpperCase();
  const region = method === 'doorstep' ? 'Greater Accra' : method === 'outside_accra' ? clean(input.delivery?.region, 40) : '';
  if (method && method !== 'pickup') {
    if (!area) fieldErrors.area = 'Enter your area or town.';
    if (!street) fieldErrors.street = 'Enter a street, house number or nearby landmark.';
    if (method === 'outside_accra' && !region) fieldErrors.region = 'Choose your region.';
  }
  if (Object.keys(fieldErrors).length) {
    return { ok: false, status: 400, error: 'Please check the highlighted details.', fieldErrors };
  }

  let pricing;
  try {
    pricing = await priceCart(items, input.couponCode ? clean(input.couponCode, 40) : null);
  } catch (err: any) {
    console.error('[order] pricing failed:', err?.message);
    return { ok: false, status: 500, error: 'We couldn’t check your bag. Please try again.' };
  }
  const { priced, issues } = pricing;
  if (issues.length) return { ok: false, status: 409, error: issues.map(i => i.message).join(' '), issues };
  if (priced.lines.length === 0 || priced.total <= 0) return { ok: false, status: 400, error: 'Your bag is empty.' };

  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');
  const needsAddress = method !== 'pickup';
  const shippingData = {
    firstName,
    lastName,
    email,
    phone,
    address: needsAddress ? street : 'Store pickup',
    city: needsAddress ? area : '',
    region,
    gpsAddress: needsAddress ? gps : '',
    country: 'Ghana',
  };
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const trackingNumber = `FL-${Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomBytes(1)[0] % 32]).join('')}`;
  const accessToken = randomBytes(18).toString('base64url');
  const feePending = method !== 'pickup' && !priced.freeShipping;

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      order_number: orderNumber,
      user_id: userId,
      email,
      phone,
      status: 'pending',
      payment_status: 'pending',
      currency: 'GHS',
      subtotal: priced.baseSubtotal,
      tax_total: 0,
      shipping_total: 0,
      discount_total: Math.round((priced.bundleSavings + priced.couponDiscount) * 100) / 100,
      total: priced.total,
      shipping_method: method,
      payment_method: 'moolre',
      shipping_address: shippingData,
      billing_address: shippingData,
      metadata: {
        guest_checkout: !userId,
        first_name: firstName,
        last_name: lastName,
        tracking_number: trackingNumber,
        payment_channel: paymentChannel,
        delivery_fee_pending: feePending,
        access_token: accessToken,
        bundle_savings: priced.bundleSavings,
        source: input.source || 'web',
        ...(priced.coupon ? { coupon_code: priced.coupon.code, coupon_discount: priced.couponDiscount } : {}),
      },
    })
    .select('id')
    .single();
  if (orderError || !order) {
    console.error('[order] order insert failed:', orderError?.message);
    return { ok: false, status: 500, error: 'We couldn’t place your order. Please try again.' };
  }

  const { error: itemsError } = await supabaseAdmin.from('order_items').insert(
    priced.lines.map(l => ({
      order_id: order.id,
      product_id: l.productId,
      variant_id: l.variantId,
      product_name: l.productName,
      variant_name: l.variantLabel,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      total_price: Math.round(l.unitPrice * l.quantity * 100) / 100,
      metadata: { image: l.image, slug: l.slug, preorder_shipping: l.preorderShipping },
    }))
  );
  if (itemsError) {
    console.error('[order] items insert failed:', itemsError.message);
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    return { ok: false, status: 500, error: 'We couldn’t place your order. Please try again.' };
  }

  // Count the coupon use (best effort; the order already records it)
  if (priced.coupon) {
    const { data: c } = await supabaseAdmin.from('coupons').select('id, usage_count').eq('code', priced.coupon.code).maybeSingle();
    if (c) await supabaseAdmin.from('coupons').update({ usage_count: (c.usage_count || 0) + 1 }).eq('id', c.id);
  }

  // Customer record for guests and account holders
  const { error: customerError } = await supabaseAdmin.rpc('upsert_customer_from_order', {
    p_email: email,
    p_phone: phone,
    p_full_name: fullName,
    p_first_name: firstName,
    p_last_name: lastName,
    p_user_id: userId,
    p_address: shippingData,
  });
  if (customerError) console.warn('[order] customer upsert failed:', customerError.message);

  if (userId && input.saveAddress && needsAddress) {
    await supabaseAdmin.from('addresses').insert({
      user_id: userId,
      type: 'shipping',
      label: 'Home',
      full_name: fullName,
      phone,
      address_line1: street,
      city: area,
      state: region,
      country: 'Ghana',
    }).then(({ error }) => { if (error) console.warn('[order] save address failed:', error.message); });
  }

  return {
    ok: true,
    orderId: order.id,
    orderNumber,
    accessToken,
    total: priced.total,
    subtotal: priced.baseSubtotal,
    bundleSavings: priced.bundleSavings,
    couponDiscount: priced.couponDiscount,
    deliveryFeePending: feePending,
    lines: priced.lines.map(l => ({ productName: l.productName, variantLabel: l.variantLabel, quantity: l.quantity, unitPrice: l.unitPrice })),
  };
}
