// Faithline's delivery promise, in one place (from the Shipping & Delivery
// policy). Deliveries run Monday to Saturday; Sundays don't count.
//   Accra & Greater Accra  1–2 business days, by our riders
//   Other regions          2–4 business days, by courier
//   Store pickup           ready within 2 hours of payment confirmation

export type DeliveryMethod = 'pickup' | 'doorstep' | 'outside_accra';

export const DELIVERY_PROMISE: Record<DeliveryMethod, { title: string; window: string; maxBusinessDays: number }> = {
  pickup: { title: 'Store pickup', window: 'Ready within 2 hours of payment', maxBusinessDays: 0 },
  doorstep: { title: 'Accra & Greater Accra', window: '1–2 business days', maxBusinessDays: 2 },
  outside_accra: { title: 'Other regions', window: '2–4 business days', maxBusinessDays: 4 },
};

export const DELIVERY_DAYS_NOTE = 'Deliveries run Monday to Saturday (no Sundays).';

export function deliveryMethodOf(shippingMethod: string | null | undefined): DeliveryMethod {
  if (shippingMethod === 'pickup') return 'pickup';
  if (shippingMethod === 'outside_accra') return 'outside_accra';
  return 'doorstep';
}

/** Add business days, skipping Sundays (deliveries run Mon–Sat). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  return d;
}

/**
 * Latest date/time the customer should expect the order, counted from when
 * the payment was confirmed (or the order was placed, if not known).
 */
export function deliveryEstimate(order: {
  shipping_method?: string | null;
  created_at?: string | null;
  metadata?: Record<string, any> | null;
}) {
  const method = deliveryMethodOf(order.shipping_method);
  const promise = DELIVERY_PROMISE[method];
  const paidAt = order.metadata?.payment_verified_at || order.metadata?.moolre_paid_at || order.created_at;
  const start = new Date(paidAt || Date.now());
  if (method === 'pickup') {
    const ready = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return {
      method,
      ...promise,
      byLabel: ready.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }),
    };
  }
  const by = addBusinessDays(start, promise.maxBusinessDays);
  return {
    method,
    ...promise,
    byLabel: by.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}
