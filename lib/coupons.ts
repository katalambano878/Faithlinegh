/** Shared client helpers for storefront coupons. */

export interface AppliedCoupon {
  code: string;
  description: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: number;
  minPurchase: number;
  maxDiscount: number | null;
}

const STORAGE_KEY = 'applied_coupon';

/** Discount amount for a coupon at a given subtotal (0 when not eligible). */
export function computeCouponDiscount(coupon: AppliedCoupon | null, subtotal: number): number {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.minPurchase > 0 && subtotal < coupon.minPurchase) return 0;
  if (coupon.type === 'percentage') {
    let discount = subtotal * (coupon.value / 100);
    if (coupon.maxDiscount != null && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    return Math.min(Math.round(discount * 100) / 100, subtotal);
  }
  if (coupon.type === 'fixed_amount') {
    return Math.min(coupon.value, subtotal);
  }
  // free_shipping affects the shipping line, not the subtotal
  return 0;
}

export function loadStoredCoupon(): AppliedCoupon | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.code === 'string' && typeof parsed.value === 'number') {
      return parsed as AppliedCoupon;
    }
  } catch {
    // fall through
  }
  return null;
}

export function saveStoredCoupon(coupon: AppliedCoupon) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coupon));
  } catch {
    // storage unavailable — coupon just won't persist across pages
  }
}

export function clearStoredCoupon() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
