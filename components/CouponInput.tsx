'use client';

import { useState } from 'react';
import {
  AppliedCoupon,
  computeCouponDiscount,
  saveStoredCoupon,
  clearStoredCoupon,
} from '@/lib/coupons';

interface CouponInputProps {
  subtotal: number;
  appliedCoupon: AppliedCoupon | null;
  onApply: (coupon: AppliedCoupon) => void;
  onRemove: () => void;
}

/** Coupon code entry, checked by the server against the live coupons table. */
export default function CouponInput({ subtotal, appliedCoupon, onApply, onRemove }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setChecking(true);
    setError('');

    try {
      const res = await fetch('/api/storefront/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, subtotal }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.coupon) {
        setError(json.error || 'That coupon code isn’t valid.');
        return;
      }
      const applied: AppliedCoupon = json.coupon;

      saveStoredCoupon(applied);
      onApply(applied);
      setCode('');
    } catch (err) {
      console.error('Coupon validation error:', err);
      setError('Could not verify the coupon. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleRemove = () => {
    clearStoredCoupon();
    onRemove();
  };

  if (appliedCoupon) {
    const discount = computeCouponDiscount(appliedCoupon, subtotal);
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <i className="ri-price-tag-3-fill text-green-700" />
              <span className="font-bold text-gray-900">{appliedCoupon.code}</span>
              <span className="text-sm font-semibold text-green-700">
                {appliedCoupon.type === 'free_shipping' ? 'Free shipping' : `−₵${discount.toFixed(2)}`}
              </span>
            </div>
            {appliedCoupon.description && (
              <p className="text-xs text-gray-600 truncate">{appliedCoupon.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 shrink-0 cursor-pointer"
            aria-label="Remove coupon"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 mb-2">
        Have a coupon code?
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder="Enter code"
          className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-brown focus:border-brand-brown text-sm uppercase"
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={checking || !code.trim()}
          className="bg-brand-brown hover:bg-brand-bag-dark text-white px-5 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
        >
          {checking ? '...' : 'Apply'}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-700 mt-2 flex items-center">
          <i className="ri-error-warning-line mr-1" />
          {error}
        </p>
      )}
    </div>
  );
}
