import { createStorefrontOrder } from './create-order';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChatProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  quantity: number;
  maxStock: number;
  moq: number;
  inStock: boolean;
  /** In-stock size / colour options, when the product has variants. */
  options?: string[];
};

export type ChatOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  created_at: string;
  tracking_number?: string;
  items: { name: string; quantity: number; price: number }[];
};

export type ChatCoupon = {
  valid: boolean;
  code: string;
  reason?: string;
  type?: string;
  value?: number;
  minimum_purchase?: number;
  maximum_discount?: number;
  expires?: string;
};

export type ChatTicket = {
  id: string;
  ticket_number: number;
  status: string;
  subject: string;
};

export type ChatReturn = {
  id: string;
  status: string;
  order_number: string;
  reason: string;
};

export type ChatCustomerProfile = {
  name: string;
  email: string;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
};

// ─── 1. Search Products (existing) ──────────────────────────────────────────

// Words that carry no product meaning in a shopper's question.
const SEARCH_STOP_WORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'have', 'has', 'any', 'some', 'with', 'that', 'this',
  'show', 'find', 'want', 'need', 'looking', 'please', 'stock', 'available', 'sell', 'buy',
  'item', 'items', 'product', 'products', 'what', 'which', 'are', 'can', 'get', 'more',
]);

/** "dresses" → "dress", "bags" → "bag", "accessories" → "accessory". */
function singularize(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(ss|sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Break a shopper's phrase into safe search terms. Shoppers say "bags" and
 * "dresses"; products are named "Curves Tote Bag" and "Denim dress", so a
 * whole-phrase match would wrongly report nothing in stock.
 */
export function productSearchTerms(query: string): string[] {
  const words = (query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !SEARCH_STOP_WORDS.has(w))
    .map(singularize);
  return Array.from(new Set(words)).slice(0, 5);
}

export async function searchProducts(
  supabase: any,
  query: string,
  limit = 4
): Promise<ChatProduct[]> {
  const terms = productSearchTerms(query);
  if (terms.length === 0) return [];

  // Categories that match a term ("bags" → Bags) widen the search to
  // everything filed under them.
  const { data: categories } = await supabase
    .from('categories')
    .select('id')
    .or(terms.map((t) => `name.ilike.%${t}%`).join(','));
  const categoryIds: string[] = (categories || []).map((c: any) => c.id);

  const filters = terms.flatMap((t) => [`name.ilike.%${t}%`, `description.ilike.%${t}%`]);
  if (categoryIds.length > 0) filters.push(`category_id.in.(${categoryIds.join(',')})`);

  const { data, error } = await supabase
    .from('products')
    .select(`id, name, slug, price, quantity, moq, metadata, description, category_id, product_images(url, position), product_variants(id, name, option2, quantity)`)
    .eq('status', 'active')
    .or(filters.join(','))
    .order('name')
    .limit(40);

  if (error) {
    console.error('[ChatTools] searchProducts error:', error);
    return [];
  }

  // Best matches first: name hits beat category hits beat description hits,
  // and in-stock pieces come before sold-out ones.
  const score = (p: any) => {
    const name = String(p.name || '').toLowerCase();
    const description = String(p.description || '').toLowerCase();
    let points = 0;
    for (const t of terms) {
      if (name.includes(t)) points += 4;
      else if (description.includes(t)) points += 1;
    }
    if (categoryIds.includes(p.category_id)) points += 2;
    if (Number(p.quantity) > 0) points += 1;
    return points;
  };

  return (data || [])
    .map((p: any) => ({ p, points: score(p) }))
    .sort((a: any, b: any) => b.points - a.points)
    .slice(0, limit)
    .map((entry: any) => mapProduct(entry.p));
}

// ─── 2. Get Product for Cart (existing) ─────────────────────────────────────

export async function getProductForCart(
  supabase: any,
  slugOrId: string
): Promise<ChatProduct | null> {
  if (!slugOrId?.trim()) return null;
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId.trim());

  const q = supabase
    .from('products')
    .select(`id, name, slug, price, quantity, moq, metadata, product_images(url, position), product_variants(id, name, option2, quantity)`)
    .eq('status', 'active');

  const { data, error } = isId
    ? await q.eq('id', slugOrId).single()
    : await q.eq('slug', slugOrId).single();

  if (error || !data) return null;
  return mapProduct(data);
}

// ─── 3. Track Order ─────────────────────────────────────────────────────────

export async function trackOrder(
  supabase: any,
  orderNumber: string,
  email: string
): Promise<ChatOrder | null> {
  if (!orderNumber?.trim() || !email?.trim()) return null;

  const { data, error } = await supabase.rpc('get_order_for_tracking', {
    p_order_number: orderNumber.trim(),
    p_email: email.trim(),
  });

  if (error || !data || typeof data !== 'object') return null;

  return {
    id: data.id,
    order_number: data.order_number,
    status: data.status,
    payment_status: data.payment_status,
    total: Number(data.total),
    created_at: data.created_at,
    tracking_number: data.metadata?.tracking_number || undefined,
    items: (data.order_items || []).map((i: any) => ({
      name: i.product_name,
      quantity: i.quantity,
      price: Number(i.unit_price),
    })),
  };
}

// ─── 4. Get Customer Orders ─────────────────────────────────────────────────

export async function getCustomerOrders(
  supabase: any,
  userId: string,
  limit = 5
): Promise<ChatOrder[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, payment_status, total, created_at, metadata,
      order_items(product_name, quantity, unit_price)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    payment_status: o.payment_status,
    total: Number(o.total),
    created_at: o.created_at,
    tracking_number: o.metadata?.tracking_number || undefined,
    items: (o.order_items || []).map((i: any) => ({
      name: i.product_name,
      quantity: i.quantity,
      price: Number(i.unit_price),
    })),
  }));
}

// ─── 5. Check Coupon ────────────────────────────────────────────────────────

export async function checkCoupon(
  supabase: any,
  code: string,
  cartTotal?: number
): Promise<ChatCoupon> {
  const trimmed = (code || '').trim().toUpperCase();
  if (!trimmed) return { valid: false, code: trimmed, reason: 'No code provided.' };

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', trimmed)
    .single();

  if (error || !data) {
    return { valid: false, code: trimmed, reason: 'This coupon code does not exist.' };
  }

  const now = new Date();
  if (!data.is_active) return { valid: false, code: trimmed, reason: 'This coupon is no longer active.' };
  if (data.start_date && new Date(data.start_date) > now) return { valid: false, code: trimmed, reason: 'This coupon is not yet valid.' };
  if (data.end_date && new Date(data.end_date) < now) return { valid: false, code: trimmed, reason: 'This coupon has expired.' };
  if (data.usage_limit && data.usage_count >= data.usage_limit) return { valid: false, code: trimmed, reason: 'This coupon has reached its usage limit.' };
  if (cartTotal !== undefined && data.minimum_purchase && cartTotal < Number(data.minimum_purchase)) {
    return { valid: false, code: trimmed, reason: `Minimum purchase of ₵${Number(data.minimum_purchase).toFixed(2)} required.` };
  }

  return {
    valid: true,
    code: trimmed,
    type: data.type,
    value: Number(data.value),
    minimum_purchase: data.minimum_purchase ? Number(data.minimum_purchase) : undefined,
    maximum_discount: data.maximum_discount ? Number(data.maximum_discount) : undefined,
    expires: data.end_date || undefined,
  };
}

// ─── 6. Create Support Ticket ───────────────────────────────────────────────

export async function createSupportTicket(
  supabase: any,
  params: { userId?: string; email: string; subject: string; description: string; category?: string }
): Promise<ChatTicket | null> {
  const { userId, email, subject, description, category } = params;
  if (!email || !subject || !description) return null;

  const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      ticket_number: ticketNumber,
      customer_id: userId || null,
      customer_email: email,
      subject,
      description,
      category: category || 'other',
      status: 'open',
      priority: 'medium',
    })
    .select('id, ticket_number, status, subject')
    .single();

  if (error || !ticket) {
    console.error('[ChatTools] createSupportTicket error:', error);
    return null;
  }

  await supabase.from('support_ticket_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_id: userId || null,
    content: description,
    is_internal: false,
  });

  return {
    id: ticket.id,
    ticket_number: ticket.ticket_number,
    status: ticket.status,
    subject: ticket.subject,
  };
}

// ─── 7. Initiate Return ─────────────────────────────────────────────────────

export async function initiateReturn(
  supabase: any,
  params: { userId: string; orderId: string; reason: string; description: string }
): Promise<ChatReturn | null> {
  const { userId, orderId, reason, description } = params;
  if (!userId || !orderId) return null;

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status, created_at, updated_at, user_id')
    .eq('id', orderId)
    .single();

  if (!order) return null;
  if (order.user_id !== userId) return null;
  if (order.status !== 'delivered') return null;

  // Last status change is when it was marked delivered
  const deliveredDate = new Date(order.updated_at || order.created_at);
  const daysSinceDelivery = (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceDelivery > 7) return null;

  const { data: ret, error } = await supabase
    .from('return_requests')
    .insert({
      order_id: orderId,
      user_id: userId,
      reason,
      description,
      status: 'pending',
    })
    .select('id, status')
    .single();

  if (error || !ret) {
    console.error('[ChatTools] initiateReturn error:', error);
    return null;
  }

  return {
    id: ret.id,
    status: ret.status,
    order_number: order.order_number,
    reason,
  };
}

// ─── 8. Get Recommendations ─────────────────────────────────────────────────

export async function getRecommendations(
  supabase: any,
  context?: string
): Promise<ChatProduct[]> {
  // A context like "dresses" or "something for work" narrows the picks to
  // matching in-stock pieces. A vague one ("popular items") matches nothing
  // and falls through to the best-rated list below.
  if (context?.trim()) {
    const matches = (await searchProducts(supabase, context, 8)).filter((p) => p.inStock);
    if (matches.length > 0) return matches.slice(0, 4);
  }

  const { data, error } = await supabase
    .from('products')
    .select(`id, name, slug, price, quantity, moq, metadata, product_images(url, position), product_variants(id, name, option2, quantity)`)
    .eq('status', 'active')
    .gt('quantity', 0)
    .order('rating_avg', { ascending: false })
    .order('review_count', { ascending: false })
    .limit(4);

  if (error || !data) return [];
  return data.map(mapProduct);
}

// ─── 9. Get Store Info (static) ─────────────────────────────────────────────

const STORE_INFO: Record<string, string> = {
  shipping: `Three ways to get your order: free store pickup (ready within 24 hours), doorstep delivery in Accra, or delivery anywhere else in Ghana (both within 48 hours). The delivery fee depends on where you are; the team contacts you with it after you order. Pickup is free.`,
  returns: `Items can be returned within 7 days. If something arrives damaged or wrong, contact us within 48 hours with photos. See the returns page for details, or I can create a support ticket for you.`,
  payment: `Payment is online through Moolre, with Mobile Money or card. There is no cash on delivery.`,
  contact: `You can reach us through:\n- This chat\n- Phone/WhatsApp: 0541770961\n- Instagram & TikTok: faithline.gh\n- Support ticket: I can create one for you right now`,
  about: `Faithlinegh is a Ghanaian fashion store offering quality, affordable bags, basics and dresses for women, with store pickup and delivery across Ghana.`,
  delivery_times: `Pickup orders are ready within 24 hours. Delivery orders, in Accra or anywhere in Ghana, arrive within 48 hours.`,
  hours: `The online store is open all the time. Customer support is available Monday-Saturday, 9 AM - 6 PM GMT.`,
};

export function getStoreInfo(topic: string): string {
  const key = (topic || '').toLowerCase().replace(/[^a-z_]/g, '');
  const match = Object.keys(STORE_INFO).find((k) => key.includes(k));
  if (match) return STORE_INFO[match];
  return Object.values(STORE_INFO).join('\n\n');
}

// ─── 10. Get Customer Profile ───────────────────────────────────────────────

export async function getCustomerProfile(
  supabase: any,
  userId: string
): Promise<ChatCustomerProfile | null> {
  if (!userId) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  const { data: customer } = await supabase
    .from('customers')
    .select('total_orders, total_spent, last_order_at')
    .eq('user_id', userId)
    .single();

  if (!profile) return null;

  return {
    name: profile.full_name || profile.email?.split('@')[0] || 'Customer',
    email: profile.email || '',
    total_orders: Number(customer?.total_orders) || 0,
    total_spent: Number(customer?.total_spent) || 0,
    last_order_at: customer?.last_order_at || null,
  };
}

// ─── 11. Create Order from Chat ─────────────────────────────────────────────

export type ChatOrderResult = {
  success: boolean;
  orderNumber?: string;
  total?: number;
  paymentUrl?: string;
  message: string;
};

interface ChatOrderItem {
  productId: string;
  quantity: number;
  /** "Colour / Size", "Size" or "Colour", exactly as listed in the product's options */
  option?: string | null;
}

interface ChatShippingInfo {
  fullName: string;
  email: string;
  phone: string;
  area?: string;
  street?: string;
  region?: string;
  gps?: string;
}

const orderRateMap = new Map<string, { count: number; resetAt: number }>();
const ORDER_RATE_LIMIT = 3;
const ORDER_RATE_WINDOW_MS = 300_000; // 3 orders per 5 minutes

function checkOrderRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = orderRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    orderRateMap.set(key, { count: 1, resetAt: now + ORDER_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= ORDER_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/** Places a chat order through the same path as website checkout, then hands back the pay link. */
export async function createChatOrder(
  _supabaseAdmin: any,
  params: {
    items: ChatOrderItem[];
    shipping: ChatShippingInfo;
    deliveryMethod: string;
    paymentChannel?: string;
    couponCode?: string | null;
    userId?: string | null;
  }
): Promise<ChatOrderResult> {
  const { items, shipping, deliveryMethod, paymentChannel, couponCode, userId } = params;
  if (!items || items.length === 0) {
    return { success: false, message: 'No items provided. Please add products to your cart first.' };
  }
  const rateKey = String(shipping?.email || shipping?.phone || '').toLowerCase().trim();
  if (rateKey && !checkOrderRateLimit(rateKey)) {
    return { success: false, message: 'Too many orders placed recently. Please wait a few minutes before trying again.' };
  }

  const result = await createStorefrontOrder({
    items: items.map(i => ({ productId: String(i.productId), quantity: Number(i.quantity), variantLabel: i.option || null })),
    contact: { fullName: shipping?.fullName, email: shipping?.email, phone: shipping?.phone },
    delivery: { method: deliveryMethod, area: shipping?.area, street: shipping?.street, region: shipping?.region, gps: shipping?.gps },
    paymentChannel,
    couponCode,
    userId,
    source: 'chat',
  });

  if (!result.ok) {
    const detail = result.fieldErrors ? Object.values(result.fieldErrors).join(' ') : result.error;
    return { success: false, message: `The order wasn’t placed: ${detail}` };
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://faithlinegh.com').replace(/\/+$/, '');
  const paymentUrl = `${baseUrl}/pay/${encodeURIComponent(result.orderNumber)}`;
  const fee = deliveryMethod === 'pickup'
    ? 'Store pickup is free.'
    : result.deliveryFeePending ? 'The delivery fee is not included; the team will contact the customer with it.' : 'Delivery is free with the coupon.';
  return {
    success: true,
    orderNumber: result.orderNumber,
    total: result.total,
    paymentUrl,
    message: `Order ${result.orderNumber} created. Total to pay now: ₵${result.total.toFixed(2)}. ${fee} The customer pays with Mobile Money or card using the payment link.`,
  };
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function mapProduct(p: any): ChatProduct {
  const qty = Number(p.quantity) ?? 0;
  const moq = Number(p.moq) || Number(p.metadata?.moq) || 1;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    image: p.product_images?.[0]?.url || '',
    quantity: qty,
    maxStock: qty,
    moq,
    inStock: qty >= moq,
    options: variantOptions(p.product_variants),
  };
}

/** "M / Red" style labels for the variants a customer can actually buy. */
function variantOptions(variants: any): string[] | undefined {
  if (!Array.isArray(variants) || variants.length === 0) return undefined;
  const labels = variants
    .filter((v) => Number(v?.quantity) > 0)
    .map((v) => Array.from(new Set([v?.option2, v?.name].map((part) => String(part || '').trim()).filter(Boolean))).join(' / '))
    .filter(Boolean);
  return labels.length > 0 ? Array.from(new Set(labels)).slice(0, 12) : undefined;
}
