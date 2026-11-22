'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCart } from '@/context/CartContext';
import { computeBundlePrice } from '@/lib/bundle-pricing';

interface MiniCartProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Orders at or above this subtotal get free delivery (matches the store banner). */
const FREE_DELIVERY_FROM = 800;

const money = (n: number) => `₵${n.toFixed(2)}`;

export default function MiniCart({ isOpen, onClose }: MiniCartProps) {
  const { cart, removeFromCart, updateQuantity, subtotal, baseSubtotal, bundleSavings } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when cart is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!mounted || !isOpen) return null;

  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const toFreeDelivery = Math.max(0, FREE_DELIVERY_FROM - subtotal);
  const freeProgress = Math.min(100, (subtotal / FREE_DELIVERY_FROM) * 100);

  // Next bundle step for the first product that has one ("Make it 5 for ₵475")
  const bundleHint = (() => {
    const groups = new Map<string, { qty: number; price: number; tiers: NonNullable<typeof cart[number]['bundlePricing']>; slug: string }>();
    for (const item of cart) {
      if (!item.bundlePricing || item.bundlePricing.length === 0) continue;
      const g = groups.get(item.id);
      if (g) g.qty += item.quantity;
      else groups.set(item.id, { qty: item.quantity, price: item.price, tiers: item.bundlePricing, slug: item.slug });
    }
    for (const g of groups.values()) {
      const next = g.tiers.find(t => t.qty > g.qty);
      if (!next) continue;
      const extra = computeBundlePrice(next.qty, g.price, g.tiers) - computeBundlePrice(g.qty, g.price, g.tiers);
      return { nextQty: next.qty, nextTotal: next.total_price, more: next.qty - g.qty, extra, slug: g.slug };
    }
    return null;
  })();

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-[#2B211B]/45 z-[9998] mini-cart-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed top-0 right-0 bottom-0 w-full max-w-[460px] bg-white shadow-[-12px_0_40px_rgba(43,33,27,0.18)] z-[9999] flex flex-col mini-cart-panel text-[#2B211B]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mini-cart-title"
      >
        <div className="flex items-center justify-between px-6 sm:px-7 py-5 border-b border-[#EFEAE3]">
          <h2 id="mini-cart-title" className="font-serif font-medium text-2xl">
            Your bag{itemCount > 0 && <span className="font-sans text-base text-[#6E6158] ml-2">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bag"
            className="w-10 h-10 flex items-center justify-center hover:bg-[#F7F4EF] rounded-full transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
            <i className="ri-shopping-bag-3-line text-5xl text-[#C9BEB1] mb-2"></i>
            <h3 className="text-lg font-semibold">Your bag is empty</h3>
            <p className="text-[#6E6158] mb-4 text-sm">Find something you love and it will show up here.</p>
            <Link
              href="/shop"
              onClick={onClose}
              className="h-12 px-6 inline-flex items-center bg-[#5B4436] text-white rounded-[14px] font-semibold hover:bg-[#47362C] transition-colors"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-5 flex flex-col gap-5">
              {cart.map((item) => (
                <div key={`${item.id}-${item.variant}`} className="flex gap-4">
                  <Link href={`/product/${item.slug}`} onClick={onClose} className="w-[84px] h-[100px] bg-[#F7F4EF] rounded-xl overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-[#C9BEB1]"><i className="ri-image-line text-2xl"></i></span>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex justify-between gap-3">
                      <h3 className="font-semibold text-[15px] line-clamp-2">{item.name}</h3>
                      <span className="font-semibold text-[15px] tabular-nums whitespace-nowrap">{money(item.price * item.quantity)}</span>
                    </div>
                    {item.variant && <p className="text-sm text-[#4E423A]">{item.variant.replace(' / ', ' · ')}</p>}
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <div className="flex items-center border border-[#E4DDD3] rounded-full">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                          aria-label={item.quantity <= (item.moq || 1) ? `Remove ${item.name}` : 'One less'}
                          className="w-9 h-9 flex items-center justify-center cursor-pointer"
                        >
                          {item.quantity <= (item.moq || 1) ? <i className="ri-delete-bin-line text-[#6E6158]"></i> : <span className="text-lg leading-none">−</span>}
                        </button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                          disabled={item.quantity >= item.maxStock}
                          aria-label="One more"
                          className="w-9 h-9 flex items-center justify-center cursor-pointer disabled:text-[#C9BEB1] disabled:cursor-not-allowed"
                        >
                          <span className="text-lg leading-none">+</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id, item.variant)}
                        className="text-[13px] text-[#6E6158] underline underline-offset-[3px] hover:text-[#2B211B] cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                    {item.quantity >= item.maxStock && <p className="text-xs text-[#8A4B1F]">That’s all we have in stock.</p>}
                  </div>
                </div>
              ))}

              {bundleSavings > 0 && (
                <div className="flex gap-2.5 items-center bg-[#E3F0E7] text-[#1F5A37] rounded-xl px-3.5 py-3 text-sm font-medium">
                  <i className="ri-price-tag-3-line text-base"></i>
                  <span>Bundle price applied. You save {money(bundleSavings)}.</span>
                </div>
              )}

              {bundleHint && (
                <div className="border border-[#E4DDD3] rounded-[14px] p-4 flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">Make it {bundleHint.nextQty} for ₵{bundleHint.nextTotal}</span>
                    <span className="text-[13px] text-[#4E423A]">{bundleHint.more} more {bundleHint.more === 1 ? 'costs' : 'cost'} {money(bundleHint.extra)}. Any colour or size.</span>
                  </div>
                  <Link
                    href={`/product/${bundleHint.slug}`}
                    onClick={onClose}
                    className="flex-none h-10 px-4 rounded-full border-[1.5px] border-[#5B4436] text-[13px] font-semibold inline-flex items-center hover:bg-[#F7F4EF] transition-colors"
                  >
                    Add {bundleHint.more} more
                  </Link>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-[13px] text-[#4E423A]">
                  {toFreeDelivery > 0
                    ? <>Add <strong className="text-[#2B211B]">{money(toFreeDelivery)}</strong> more for free delivery</>
                    : <strong className="text-[#1F5A37]">Your order gets free delivery</strong>}
                </span>
                <div role="progressbar" aria-label="Progress to free delivery" aria-valuemin={0} aria-valuemax={FREE_DELIVERY_FROM} aria-valuenow={Math.min(subtotal, FREE_DELIVERY_FROM)} className="h-1.5 bg-[#EFEAE3] rounded-full overflow-hidden">
                  <div className="h-full bg-[#5B4436] rounded-full transition-[width] duration-300 ease-out" style={{ width: `${freeProgress}%` }} />
                </div>
              </div>
            </div>

            <div className="border-t border-[#EFEAE3] px-6 sm:px-7 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-3 bg-white">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Subtotal</span>
                <span className="tabular-nums">
                  {bundleSavings > 0 && <span className="text-sm text-[#6E6158] line-through mr-2">{money(baseSubtotal)}</span>}
                  <span className="text-lg font-bold">{money(subtotal)}</span>
                </span>
              </div>
              <p className="text-[13px] text-[#6E6158] -mt-1.5">Choose pickup or delivery at checkout.</p>
              <Link
                href="/checkout"
                onClick={onClose}
                className="h-14 rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white font-semibold flex items-center justify-center transition-colors"
              >
                Checkout
              </Link>
              <div className="flex justify-between text-sm">
                <Link href="/cart" onClick={onClose} className="underline underline-offset-[3px]">View bag</Link>
                <button type="button" onClick={onClose} className="underline underline-offset-[3px] cursor-pointer">Continue shopping</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}
