'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCart } from '@/context/CartContext';

interface MiniCartProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MiniCart({ isOpen, onClose }: MiniCartProps) {
  const { cart, removeFromCart, updateQuantity, subtotal, bundleSavings } = useCart();
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

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-brand-brown/40 backdrop-blur-sm z-[9998] mini-cart-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-brand-cream shadow-2xl z-[9999] flex flex-col mini-cart-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between p-6 border-b border-brand-carton/20">
          <h2 className="text-xl font-bold text-brand-brown">
            Shopping Cart ({cart.reduce((sum, i) => sum + i.quantity, 0)})
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-brand-brown/5 rounded-full transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-2xl text-brand-brown/60"></i>
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 flex items-center justify-center bg-white rounded-full mb-4 ring-1 ring-brand-carton/20">
              <i className="ri-shopping-cart-line text-5xl text-brand-carton"></i>
            </div>
            <h3 className="text-xl font-semibold text-brand-brown mb-2">Your cart is empty</h3>
            <p className="text-brand-brown/60 mb-6">Add items to get started</p>
            <Link
              href="/shop"
              onClick={onClose}
              className="px-6 py-3 bg-brand-brown text-white rounded-full font-semibold hover:bg-[#47362C] transition-colors whitespace-nowrap cursor-pointer shadow-md shadow-brand-brown/20"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={`${item.id}-${item.variant}`} className="flex space-x-4 bg-white rounded-xl p-4 ring-1 ring-brand-carton/15">
                    <div className="w-20 h-20 bg-brand-cream rounded-lg overflow-hidden flex-shrink-0 border border-brand-carton/15">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand-cream text-brand-carton/40">
                          <i className="ri-image-line text-2xl"></i>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-brand-brown mb-1 line-clamp-1">{item.name}</h3>
                      {item.variant && (
                        <p className="text-xs text-brand-brown/55 mb-2">
                          Variant: {item.variant}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-lg font-bold text-brand-brown">
                          ₵{item.price.toFixed(2)}
                        </span>

                        <div className="flex items-center border border-brand-carton/25 rounded-lg bg-white">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-brand-cream transition-colors cursor-pointer"
                          >
                            {item.quantity <= (item.moq || 1) ? (
                              <i className="ri-delete-bin-line text-brand-coral"></i>
                            ) : (
                              <i className="ri-subtract-line text-brand-brown/70"></i>
                            )}
                          </button>
                          <span className="w-10 text-center font-semibold text-brand-brown">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-brand-cream transition-colors cursor-pointer"
                            disabled={item.quantity >= item.maxStock}
                          >
                            <i className="ri-add-line text-brand-brown/70"></i>
                          </button>
                        </div>
                      </div>
                      {item.quantity >= item.maxStock && (
                        <p className="text-xs text-brand-carton mt-1">Max stock reached</p>
                      )}
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id, item.variant)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-brand-pink/50 rounded-full transition-colors flex-shrink-0 cursor-pointer"
                    >
                      <i className="ri-delete-bin-line text-brand-oxblood"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-brand-carton/20 p-6 bg-white">
              {bundleSavings > 0 && (
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-green-700 font-medium flex items-center gap-1">
                    <i className="ri-stack-line"></i> Bundle savings
                  </span>
                  <span className="font-bold text-green-700">−₵{bundleSavings.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <span className="text-brand-brown/70 font-medium">Subtotal</span>
                <span className="text-2xl font-bold text-brand-brown">₵{subtotal.toFixed(2)}</span>
              </div>

              <p className="text-sm text-brand-brown/55 mb-4 text-center">
                Shipping calculated at checkout
              </p>

              <div className="space-y-3">
                <Link
                  href="/checkout"
                  onClick={onClose}
                  className="block w-full py-4 bg-brand-brown text-white text-center rounded-full font-semibold hover:bg-[#47362C] transition-colors whitespace-nowrap cursor-pointer shadow-md shadow-brand-brown/20"
                >
                  Proceed to Checkout
                </Link>
                <Link
                  href="/cart"
                  onClick={onClose}
                  className="block w-full py-4 border-2 border-brand-brown text-brand-brown text-center rounded-full font-semibold hover:bg-brand-cream transition-colors whitespace-nowrap cursor-pointer"
                >
                  View Cart
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}
