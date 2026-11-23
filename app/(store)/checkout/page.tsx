'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CouponInput from '@/components/CouponInput';
import BodyPortal from '@/components/BodyPortal';
import { useCart } from '@/context/CartContext';
import { useCMS } from '@/context/CMSContext';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { AppliedCoupon, computeCouponDiscount, loadStoredCoupon, clearStoredCoupon } from '@/lib/coupons';
import { imgSrc } from '@/lib/img';

type DeliveryMethod = 'pickup' | 'doorstep' | 'outside_accra';
type PaymentChannel = 'momo' | 'card';

/**
 * Delivery fees in cedis. `null` means the fee is not fixed yet: the order goes
 * through without it and the team tells the customer the fee (the admin's
 * chosen process, confirmed 2026-11-22).
 * Set a number here once the admin confirms the price.
 */
const DELIVERY_FEES: Record<DeliveryMethod, number | null> = {
  pickup: 0,
  doorstep: null,
  outside_accra: null,
};

const DELIVERY_OPTIONS: { id: DeliveryMethod; title: string; note: string }[] = [
  { id: 'pickup', title: 'Store pickup', note: 'Ready within 2 hours of payment' },
  { id: 'doorstep', title: 'Delivery in Accra & Greater Accra', note: '1–2 business days, by our riders' },
  { id: 'outside_accra', title: 'Delivery to other regions', note: '2–4 business days, by courier' },
];

const OTHER_REGIONS = [
  'Ashanti', 'Western', 'Western North', 'Central', 'Eastern', 'Volta', 'Oti', 'Bono',
  'Bono East', 'Ahafo', 'Northern', 'Savannah', 'North East', 'Upper East', 'Upper West',
];

const money = (n: number) => `₵${n.toFixed(2)}`;

/** Ghana numbers: accept 024…, 24…, 233…, +233… and store as +233XXXXXXXXX. */
function normalizeGhanaPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^\d{9}$/.test(digits) ? `+233${digits}` : null;
}

const inputClass = (hasError?: boolean) =>
  `w-full h-[52px] rounded-xl border bg-white px-3.5 text-base text-[#2B211B] placeholder:text-[#8C7F76] caret-[#5B4436] outline-none transition-shadow focus:border-[#5B4436] focus:shadow-[0_0_0_3px_rgba(91,68,54,0.15)] ${hasError ? 'border-[#A3392B]' : 'border-[#D8CFC3]'}`;

export default function CheckoutPage() {
  usePageTitle('Checkout');
  const router = useRouter();
  const { cart, subtotal: cartSubtotal, baseSubtotal, bundleSavings, clearCart } = useCart();
  const { getSetting } = useCMS();
  const { getToken } = useRecaptcha();

  const [isLoading, setIsLoading] = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingOrder, setPendingOrder] = useState<{ orderNumber: string; total: number } | null>(null);

  // An order placed in the last day but not yet paid (customer left Moolre)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('fl_pending_order');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p?.orderNumber && Date.now() - (p.at || 0) < 24 * 60 * 60 * 1000) setPendingOrder({ orderNumber: p.orderNumber, total: Number(p.total) || 0 });
      else localStorage.removeItem('fl_pending_order');
    } catch { /* ignore */ }
  }, []);

  const [contact, setContact] = useState({ phone: '', fullName: '', email: '' });
  const [address, setAddress] = useState({ region: OTHER_REGIONS[0], area: '', street: '', gps: '' });
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('momo');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLInputElement>(null);
  const streetRef = useRef<HTMLInputElement>(null);

  // Restore a coupon applied on the cart page
  useEffect(() => {
    const stored = loadStoredCoupon();
    setAppliedCoupon(stored);
    if (stored) setCouponOpen(true);
  }, []);

  // Signed-in shoppers: pre-fill what we know
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const meta = session.user.user_metadata || {};
        setContact(prev => ({
          ...prev,
          email: session.user.email || prev.email,
          fullName: prev.fullName || meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' '),
          phone: prev.phone || (meta.phone || '').replace(/^\+?233/, '0'),
        }));
      }
    }
    checkUser();
  }, []);

  // Totals. `cartSubtotal` is bundle-aware (what the customer pays);
  // `baseSubtotal` is plain unit pricing and matches the sum of order line items.
  const subtotal = baseSubtotal;
  // Only a free-shipping coupon makes delivery free; there is no order-size threshold.
  const freeDelivery = appliedCoupon?.type === 'free_shipping';
  const configuredFee = DELIVERY_FEES[deliveryMethod];
  const feeKnown = deliveryMethod === 'pickup' || freeDelivery || configuredFee !== null;
  const shippingCost = deliveryMethod === 'pickup' || freeDelivery ? 0 : (configuredFee ?? 0);
  const tax = 0;
  const couponDiscount = computeCouponDiscount(appliedCoupon, cartSubtotal);
  const total = Math.max(cartSubtotal - couponDiscount + shippingCost + tax, 0);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const needsAddress = deliveryMethod !== 'pickup';

  const storeAddress = getSetting('contact_address') || 'Accra, Ghana';
  const whatsappDigits = (getSetting('contact_phone') || '0541770961').replace(/\D/g, '').replace(/^0/, '233');

  const feeLabel = (id: DeliveryMethod) => {
    if (id === 'pickup' || freeDelivery) return 'Free';
    const fee = DELIVERY_FEES[id];
    return fee === null ? 'Fee confirmed later' : money(fee);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!normalizeGhanaPhone(contact.phone)) next.phone = 'Enter your phone number, for example 024 123 4567.';
    if (contact.fullName.trim().length < 2) next.fullName = 'Enter your full name.';
    if (!contact.email.trim()) next.email = 'Enter your email for the receipt.';
    else if (!/\S+@\S+\.\S+/.test(contact.email.trim())) next.email = 'Check your email address, for example ama@gmail.com.';
    if (needsAddress) {
      if (!address.area.trim()) next.area = deliveryMethod === 'doorstep' ? 'Enter your area, for example East Legon.' : 'Enter your town or city.';
      if (!address.street.trim()) next.street = 'Enter a street, house number or nearby landmark.';
    }
    setErrors(next);
    const order: [string, React.RefObject<HTMLInputElement | null>][] = [
      ['phone', phoneRef], ['fullName', nameRef], ['email', emailRef], ['area', areaRef], ['street', streetRef],
    ];
    const first = order.find(([key]) => next[key]);
    if (first) first[1].current?.focus();
    return Object.keys(next).length === 0;
  };

  const handlePlaceOrder = async () => {
    setFormError('');
    if (cart.length === 0) {
      setFormError('Your bag is empty.');
      return;
    }
    if (!validate()) return;

    setIsLoading(true);

    const isHuman = await getToken('checkout');
    if (!isHuman) {
      setFormError('We could not verify this browser. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      // The server prices the bag from the database and saves the order;
      // we only send what the customer chose.
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/storefront/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.id,
            variantId: item.variantId ?? null,
            variantLabel: item.variant ?? null,
            quantity: item.quantity,
          })),
          contact,
          delivery: { method: deliveryMethod, region: address.region, area: address.area, street: address.street, gps: address.gps },
          paymentChannel,
          couponCode: appliedCoupon?.code ?? null,
          saveAddress,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.orderNumber) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        setFormError(result.error || 'We couldn’t place your order. Please try again.');
        setIsLoading(false);
        return;
      }

      const orderNumber: string = result.orderNumber;
      // Lets the customer get back to this order if they leave the payment page
      try {
        localStorage.setItem('fl_pending_order', JSON.stringify({ orderNumber, accessToken: result.accessToken, total: result.total, at: Date.now() }));
      } catch { /* storage unavailable */ }
      clearCart();
      clearStoredCoupon();

      // Hand off to Moolre (Mobile Money or card)
      const paymentRes = await fetch('/api/payment/moolre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderNumber }),
      });
      const paymentResult = await paymentRes.json().catch(() => ({}));
      if (!paymentResult.success || !paymentResult.url) {
        // The order is saved; its pay page lets the customer try again
        router.push(`/pay/${encodeURIComponent(orderNumber)}`);
        return;
      }
      window.location.href = paymentResult.url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      setFormError('We couldn’t place your order. Check your connection and try again.');
      setIsLoading(false);
    }
  };

  if (cart.length === 0 && !isLoading) {
    return (
      <main className="min-h-[70vh] bg-white flex items-center justify-center px-4 text-[#2B211B]">
        <div className="max-w-sm text-center flex flex-col items-center gap-3">
          <i className="ri-shopping-bag-3-line text-5xl text-[#C9BEB1]"></i>
          <h1 className="font-serif font-medium text-3xl">Your bag is empty</h1>
          {pendingOrder ? (
            <>
              <p className="text-[#4E423A]">You have an order waiting for payment ({pendingOrder.orderNumber}).</p>
              <Link href={`/pay/${encodeURIComponent(pendingOrder.orderNumber)}`} className="mt-1 h-12 px-6 inline-flex items-center bg-[#5B4436] hover:bg-[#47362C] text-white rounded-[14px] font-semibold transition-colors">
                Finish paying ₵{pendingOrder.total.toFixed(2)}
              </Link>
            </>
          ) : (
            <p className="text-[#4E423A]">Add something you love, then come back to check out.</p>
          )}
          <Link href="/shop" className="mt-3 h-12 px-6 inline-flex items-center bg-[#5B4436] hover:bg-[#47362C] text-white rounded-[14px] font-semibold transition-colors">
            Start shopping
          </Link>
        </div>
      </main>
    );
  }

  const payLabel = `Pay ${money(total)}`;

  const summaryLines = (
    <>
      <ul className="flex flex-col gap-4">
        {cart.map(item => (
          <li key={`${item.id}-${item.variant}`} className="flex gap-3.5 items-center">
            <div className="relative w-16 h-[76px] flex-none bg-white rounded-[10px]">
              {item.image && <img {...imgSrc(item.image, '72px', 256)} loading="lazy" decoding="async" alt="" className="w-full h-full object-cover rounded-[10px]" />}
              <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#2B211B] text-white text-xs font-semibold flex items-center justify-center tabular-nums">{item.quantity}</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="font-semibold text-sm line-clamp-1">{item.name}</span>
              {item.variant && <span className="text-[13px] text-[#4E423A]">{item.variant.replace(' / ', ' · ')}</span>}
            </div>
            <span className="text-sm font-semibold tabular-nums">{money(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>

      {couponOpen || appliedCoupon ? (
        <CouponInput
          subtotal={cartSubtotal}
          appliedCoupon={appliedCoupon}
          onApply={setAppliedCoupon}
          onRemove={() => setAppliedCoupon(null)}
        />
      ) : (
        <button type="button" onClick={() => setCouponOpen(true)} className="self-start text-sm font-semibold text-[#5B4436] underline underline-offset-[3px] cursor-pointer">
          Add a discount code
        </button>
      )}

      <dl className="flex flex-col gap-2.5 text-sm border-t border-[#E4DDD3] pt-4 tabular-nums">
        <div className="flex justify-between"><dt className="text-[#4E423A]">Subtotal · {itemCount} {itemCount === 1 ? 'item' : 'items'}</dt><dd>{money(subtotal)}</dd></div>
        {bundleSavings > 0 && <div className="flex justify-between text-[#1F5A37]"><dt>Bundle savings</dt><dd>−{money(bundleSavings)}</dd></div>}
        {couponDiscount > 0 && <div className="flex justify-between text-[#1F5A37]"><dt>Discount{appliedCoupon ? ` (${appliedCoupon.code})` : ''}</dt><dd>−{money(couponDiscount)}</dd></div>}
        <div className="flex justify-between">
          <dt className="text-[#4E423A]">{deliveryMethod === 'pickup' ? 'Store pickup' : 'Delivery'}</dt>
          <dd className={feeKnown && shippingCost === 0 ? 'text-[#1F5A37]' : feeKnown ? '' : 'text-[#8A4B1F]'}>
            {feeKnown ? (shippingCost === 0 ? 'Free' : money(shippingCost)) : 'We’ll contact you'}
          </dd>
        </div>
      </dl>
      <div className="flex justify-between items-baseline border-t border-[#E4DDD3] pt-4">
        <span className="font-semibold text-base">Total</span>
        <span className="tabular-nums text-[26px] font-bold">{money(total)}</span>
      </div>
    </>
  );

  return (
    <main className="min-h-screen bg-white text-[#2B211B] pb-32 lg:pb-0">
      {/* Phone: order summary folds away above the form */}
      <div className="lg:hidden bg-[#F7F4EF] border-b border-[#EFEAE3]">
        <button
          type="button"
          onClick={() => setSummaryOpen(!summaryOpen)}
          aria-expanded={summaryOpen}
          aria-controls="mobile-summary"
          className="w-full min-h-[56px] px-4 flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[#5B4436]">
            {summaryOpen ? 'Hide order summary' : 'Show order summary'}
            <i className={`ri-arrow-down-s-line text-lg transition-transform duration-200 ${summaryOpen ? 'rotate-180' : ''}`}></i>
          </span>
          <span className="text-[17px] font-bold tabular-nums">{money(total)}</span>
        </button>
        {summaryOpen && (
          <div id="mobile-summary" className="px-4 pb-5 pt-1 flex flex-col gap-4">{summaryLines}</div>
        )}
      </div>

      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 lg:pb-24 flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
        <div className="flex-1 min-w-0 w-full flex flex-col gap-9 lg:gap-10">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif font-medium text-[32px] lg:text-[40px] leading-[1.1]">Checkout</h1>
            <span className="flex items-center gap-1.5 text-[13px] text-[#4E423A]"><i className="ri-lock-line"></i>Secure checkout</span>
          </div>

          {/* Contact */}
          <section aria-labelledby="contact-h" className="flex flex-col gap-4">
            <div className="flex justify-between items-baseline gap-3 flex-wrap">
              <h2 id="contact-h" className="font-serif font-medium text-[24px] lg:text-[26px]">Contact</h2>
              {user ? (
                <span className="text-sm text-[#4E423A]">Signed in as {user.email}</span>
              ) : (
                <span className="text-sm text-[#4E423A]">Have an account? <Link href="/auth/login?redirect=/checkout" className="text-[#5B4436] font-semibold underline underline-offset-[3px]">Sign in</Link></span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-sm font-semibold">Phone number</label>
              <div className={`flex h-[52px] rounded-xl border overflow-hidden bg-white transition-shadow focus-within:border-[#5B4436] focus-within:shadow-[0_0_0_3px_rgba(91,68,54,0.15)] ${errors.phone ? 'border-[#A3392B]' : 'border-[#D8CFC3]'}`}>
                <span className="flex items-center px-3.5 bg-[#F7F4EF] border-r border-[#E4DDD3] font-semibold text-[#4E423A]">+233</span>
                <input
                  ref={phoneRef}
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={contact.phone}
                  onChange={(e) => { setContact({ ...contact, phone: e.target.value }); if (errors.phone) setErrors({ ...errors, phone: '' }); }}
                  placeholder="24 123 4567"
                  aria-invalid={!!errors.phone}
                  aria-describedby="phone-help"
                  className="flex-1 min-w-0 px-3.5 text-base bg-transparent outline-none placeholder:text-[#8C7F76] caret-[#5B4436]"
                />
              </div>
              <span id="phone-help" className={`text-[13px] ${errors.phone ? 'text-[#A3392B] font-medium' : 'text-[#6E6158]'}`}>
                {errors.phone || 'We text your order and delivery updates here.'}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fullName" className="text-sm font-semibold">Full name</label>
                <input
                  ref={nameRef}
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={contact.fullName}
                  onChange={(e) => { setContact({ ...contact, fullName: e.target.value }); if (errors.fullName) setErrors({ ...errors, fullName: '' }); }}
                  aria-invalid={!!errors.fullName}
                  className={inputClass(!!errors.fullName)}
                />
                {errors.fullName && <span className="text-[13px] text-[#A3392B] font-medium">{errors.fullName}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-semibold">Email</label>
                <input
                  ref={emailRef}
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={contact.email}
                  readOnly={!!user}
                  onChange={(e) => { setContact({ ...contact, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: '' }); }}
                  aria-invalid={!!errors.email}
                  className={`${inputClass(!!errors.email)} ${user ? 'bg-[#F7F4EF] text-[#4E423A]' : ''}`}
                />
                <span className={`text-[13px] ${errors.email ? 'text-[#A3392B] font-medium' : 'text-[#6E6158]'}`}>{errors.email || 'For your receipt.'}</span>
              </div>
            </div>
          </section>

          <div className="h-px bg-[#EFEAE3]"></div>

          {/* Delivery */}
          <section aria-labelledby="delivery-h" className="flex flex-col gap-4">
            <h2 id="delivery-h" className="font-serif font-medium text-[24px] lg:text-[26px]">Delivery</h2>
            <div role="radiogroup" aria-labelledby="delivery-h" className="flex flex-col gap-2.5">
              {DELIVERY_OPTIONS.map(option => {
                const selected = deliveryMethod === option.id;
                const label = feeLabel(option.id);
                return (
                  <label
                    key={option.id}
                    className={`flex gap-3.5 items-start p-4 lg:p-[18px] rounded-[14px] cursor-pointer transition-colors ${selected ? 'border-[1.5px] border-[#5B4436] bg-[#F7F4EF]' : 'border border-[#E4DDD3] bg-white hover:border-[#C9BEB1]'}`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      value={option.id}
                      checked={selected}
                      onChange={() => setDeliveryMethod(option.id)}
                      className="mt-0.5 w-5 h-5 flex-none accent-[#5B4436]"
                    />
                    <span className="flex-1 flex flex-col">
                      <span className="font-semibold text-[15px]">{option.title}</span>
                      <span className="text-[13px] lg:text-sm text-[#4E423A]">{option.note}</span>
                    </span>
                    <span className={`font-semibold text-sm whitespace-nowrap ${label === 'Free' ? 'text-[#1F5A37]' : label === 'Fee confirmed later' ? 'text-[#8A4B1F]' : ''}`}>{label}</span>
                  </label>
                );
              })}
            </div>

            {deliveryMethod === 'pickup' && (
              <div className="flex gap-3.5 p-4 lg:p-[18px] bg-[#F7F4EF] rounded-[14px] text-sm">
                <i className="ri-map-pin-line text-xl text-[#5B4436] leading-none"></i>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">Pick up from {storeAddress}</span>
                  <span className="text-[#4E423A]">We text you when your order is ready to collect. Bring your order number.</span>
                </div>
              </div>
            )}

            {needsAddress && (
              <div className="flex flex-col gap-4">
                {!feeKnown && (
                  <p className="text-[13px] text-[#4E423A] bg-[#F7F4EF] rounded-xl px-4 py-3">
                    You pay for your items now. We’ll contact you with the delivery fee for your area before we send your order.
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="region" className="text-sm font-semibold">Region</label>
                    {deliveryMethod === 'doorstep' ? (
                      <input id="region" type="text" value="Greater Accra" readOnly className={`${inputClass()} bg-[#F7F4EF] text-[#4E423A]`} />
                    ) : (
                      <select
                        id="region"
                        value={address.region}
                        onChange={(e) => setAddress({ ...address, region: e.target.value })}
                        className={`${inputClass()} pr-10`}
                      >
                        {OTHER_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="area" className="text-sm font-semibold">{deliveryMethod === 'doorstep' ? 'Area' : 'Town or city'}</label>
                    <input
                      ref={areaRef}
                      id="area"
                      type="text"
                      autoComplete="address-level2"
                      value={address.area}
                      onChange={(e) => { setAddress({ ...address, area: e.target.value }); if (errors.area) setErrors({ ...errors, area: '' }); }}
                      placeholder={deliveryMethod === 'doorstep' ? 'e.g. East Legon' : 'e.g. Kumasi'}
                      aria-invalid={!!errors.area}
                      className={inputClass(!!errors.area)}
                    />
                    {errors.area && <span className="text-[13px] text-[#A3392B] font-medium">{errors.area}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="street" className="text-sm font-semibold">Street, house number or nearest landmark</label>
                  <input
                    ref={streetRef}
                    id="street"
                    type="text"
                    autoComplete="address-line1"
                    value={address.street}
                    onChange={(e) => { setAddress({ ...address, street: e.target.value }); if (errors.street) setErrors({ ...errors, street: '' }); }}
                    placeholder="e.g. Off Lagos Avenue, behind the Shell station"
                    aria-invalid={!!errors.street}
                    className={inputClass(!!errors.street)}
                  />
                  {errors.street && <span className="text-[13px] text-[#A3392B] font-medium">{errors.street}</span>}
                </div>
                <div className="flex flex-col gap-1.5 sm:max-w-[280px]">
                  <label htmlFor="gps" className="text-sm font-semibold">GhanaPost GPS address <span className="font-medium text-[#6E6158]">(optional)</span></label>
                  <input
                    id="gps"
                    type="text"
                    value={address.gps}
                    onChange={(e) => setAddress({ ...address, gps: e.target.value.toUpperCase() })}
                    placeholder="e.g. GA-123-4567"
                    className={inputClass()}
                  />
                </div>
                {user && (
                  <label className="flex items-center gap-3 cursor-pointer text-sm text-[#4E423A]">
                    <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="w-[18px] h-[18px] accent-[#5B4436]" />
                    Save this address for next time
                  </label>
                )}
              </div>
            )}
          </section>

          <div className="h-px bg-[#EFEAE3]"></div>

          {/* Payment */}
          <section aria-labelledby="pay-h" className="flex flex-col gap-4">
            <div className="flex justify-between items-baseline gap-3 flex-wrap">
              <h2 id="pay-h" className="font-serif font-medium text-[24px] lg:text-[26px]">Payment</h2>
              <span className="flex items-center gap-1.5 text-[13px] text-[#6E6158]"><i className="ri-lock-line"></i>Processed securely by Moolre</span>
            </div>
            <div role="radiogroup" aria-labelledby="pay-h" className="grid sm:grid-cols-2 gap-2.5">
              {([
                { id: 'momo', title: 'Mobile Money', chips: ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'] },
                { id: 'card', title: 'Debit or credit card', chips: ['Visa', 'Mastercard'] },
              ] as { id: PaymentChannel; title: string; chips: string[] }[]).map(option => {
                const selected = paymentChannel === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex gap-3.5 items-start p-4 lg:p-[18px] rounded-[14px] cursor-pointer transition-colors ${selected ? 'border-[1.5px] border-[#5B4436] bg-[#F7F4EF]' : 'border border-[#E4DDD3] bg-white hover:border-[#C9BEB1]'}`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={option.id}
                      checked={selected}
                      onChange={() => setPaymentChannel(option.id)}
                      className="mt-0.5 w-5 h-5 flex-none accent-[#5B4436]"
                    />
                    <span className="flex flex-col gap-2">
                      <span className="font-semibold text-[15px]">{option.title}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {option.chips.map(c => (
                          <span key={c} className="text-xs font-semibold bg-white border border-[#E4DDD3] rounded-md px-2 py-0.5">{c}</span>
                        ))}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3 items-start text-sm text-[#4E423A] px-4 py-3.5 border border-[#EFEAE3] rounded-xl">
              <i className="ri-information-line text-lg text-[#5B4436] leading-none mt-0.5"></i>
              <span>
                {paymentChannel === 'momo'
                  ? 'Moolre’s secure page opens next. Confirm your MoMo number there and approve with your PIN, then you come straight back here.'
                  : 'Moolre’s secure page opens next for your card details. We never see or store your card number.'}
              </span>
            </div>
          </section>

          {formError && (
            <div role="alert" className="flex gap-3 items-start text-sm text-[#A3392B] bg-[#FBEDEA] rounded-xl px-4 py-3.5">
              <i className="ri-error-warning-line text-lg leading-none mt-0.5"></i>
              <span>{formError}</span>
            </div>
          )}

          <div className="hidden lg:flex flex-col gap-3">
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={isLoading}
              className="h-[60px] rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white text-[17px] font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-70 active:scale-[0.99]"
            >
              <i className="ri-lock-line"></i>{payLabel}
            </button>
            <p className="text-[13px] text-[#6E6158] text-center">Your order is saved first. If payment is interrupted, we text you a link to finish it.</p>
            <p className="text-xs text-[#6E6158] text-center">By paying you agree to our <Link href="/terms" className="underline underline-offset-2 text-[#4E423A]">Terms</Link> and <Link href="/returns" className="underline underline-offset-2 text-[#4E423A]">Returns policy</Link>.</p>
          </div>
          <p className="lg:hidden text-xs text-[#6E6158]">Your order is saved first, so you can finish paying later from the link we text you. By paying you agree to our <Link href="/terms" className="underline underline-offset-2">Terms</Link> and <Link href="/returns" className="underline underline-offset-2">Returns policy</Link>.</p>
        </div>

        {/* Desktop: order summary */}
        <aside aria-label="Order summary" className="hidden lg:flex w-[400px] flex-none sticky top-24 bg-[#F7F4EF] rounded-[20px] p-7 flex-col gap-5">
          <div className="flex justify-between items-baseline">
            <h2 className="font-serif font-medium text-[22px]">Your bag</h2>
            <Link href="/cart" className="text-sm text-[#5B4436] underline underline-offset-[3px]">Edit</Link>
          </div>
          {summaryLines}
          <div className="flex flex-col gap-2.5 text-[13px] text-[#4E423A] border-t border-[#E4DDD3] pt-4">
            <span className="flex gap-2.5 items-center"><i className="ri-truck-line text-base text-[#5B4436]"></i>Deliveries Monday to Saturday</span>
            <Link href="/returns" className="flex gap-2.5 items-center underline underline-offset-[3px]"><i className="ri-file-list-3-line text-base text-[#5B4436]"></i>All sales final. See our returns policy</Link>
            <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer" className="flex gap-2.5 items-center underline underline-offset-[3px]"><i className="ri-whatsapp-line text-base text-[#5B4436]"></i>Questions? Chat with us on WhatsApp</a>
          </div>
        </aside>
      </div>

      {/* Phone: pay button always in reach */}
      <BodyPortal>
      <div className="lg:hidden fixed left-0 right-0 bottom-0 z-40 bg-white border-t border-[#EFEAE3] shadow-[0_-6px_20px_rgba(43,33,27,0.06)] px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={isLoading}
          className="w-full h-14 rounded-[14px] bg-[#5B4436] active:bg-[#47362C] text-white text-base font-semibold flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-70"
        >
          <i className="ri-lock-line"></i>{payLabel}
        </button>
      </div>

      {/* Handing off to Moolre */}
      {isLoading && (
        <div className="fixed inset-0 z-[10000] bg-[#2B211B]/45 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="handoff-h">
          <div className="w-full sm:max-w-[440px] bg-white rounded-t-3xl sm:rounded-3xl px-6 pt-7 pb-[max(28px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-[0_-12px_40px_rgba(43,33,27,0.18)]">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full border-[2.5px] border-[#E4DDD3] border-t-[#5B4436] animate-spin" aria-hidden="true"></span>
              <h2 id="handoff-h" className="font-serif font-medium text-[24px] leading-tight">Opening secure payment</h2>
            </div>
            <ol className="flex flex-col gap-4">
              {(paymentChannel === 'momo'
                ? [['Moolre’s secure page opens', 'Faithline’s payment partner'], ['Confirm your MoMo number', 'MTN, Telecel or AirtelTigo'], ['Approve with your MoMo PIN', 'Then you come straight back to your order']]
                : [['Moolre’s secure page opens', 'Faithline’s payment partner'], ['Enter your card details', 'Visa or Mastercard'], ['Confirm with your bank', 'Then you come straight back to your order']]
              ).map(([title, note], i) => (
                <li key={title} className="flex gap-3.5 items-start">
                  <span className="w-7 h-7 flex-none rounded-full bg-[#F7F4EF] text-[#5B4436] font-bold text-sm flex items-center justify-center">{i + 1}</span>
                  <span className="text-[15px]"><strong className="font-semibold">{title}</strong><br /><span className="text-sm text-[#4E423A]">{note}</span></span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-[#6E6158]">Paying {money(total)}. Your order is saved, so if you stop halfway we text you a link to finish.</p>
          </div>
        </div>
      )}
      </BodyPortal>
    </main>
  );
}
