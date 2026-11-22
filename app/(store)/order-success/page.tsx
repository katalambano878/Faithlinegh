'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';

const money = (n: number) => `₵${Number(n || 0).toFixed(2)}`;
const HOUR = 60 * 60 * 1000;

/** Delivery promise shown to customers: delivery within 48 hours, pickup ready within 24 hours. */
function deliveryPromise(order: any) {
  const placed = new Date(order.created_at || Date.now());
  const isPickup = order.shipping_method === 'pickup';
  const by = new Date(placed.getTime() + (isPickup ? 24 : 48) * HOUR);
  const byLabel = by.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return isPickup
    ? { title: 'Ready to collect', window: 'Within 24 hours', by: byLabel }
    : { title: 'Delivered', window: 'Within 48 hours', by: byLabel };
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const paymentSuccess = searchParams.get('payment_success');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderNumber) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/storefront/orders/${encodeURIComponent(orderNumber)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Order not found');
        const orderData = json.order;
        setOrder(orderData);

        // Back from Moolre but the webhook has not marked it paid yet: check again
        if (paymentSuccess === 'true' && orderData && orderData.payment_status !== 'paid') {
          verifyPayment(orderNumber);
        }
      } catch (err) {
        console.error('Error fetching order:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderNumber, paymentSuccess]);

  // Called when the shopper returns from Moolre with payment_success=true
  const verifyPayment = async (orderNum: string) => {
    setVerifying(true);

    const refreshOrder = async () => {
      const r = await fetch(`/api/storefront/orders/${encodeURIComponent(orderNum)}`);
      const j = await r.json();
      return j.order;
    };

    // Give the webhook up to ~30s to fire
    const delays = [3000, 3000, 4000, 5000, 5000, 5000, 5000];
    for (const delay of delays) {
      await new Promise(resolve => setTimeout(resolve, delay));
      const refreshed = await refreshOrder().catch(() => null);
      if (refreshed?.payment_status === 'paid') {
        setOrder(refreshed);
        setVerifying(false);
        return;
      }
    }

    // Webhook never fired: ask Moolre directly
    try {
      const res = await fetch('/api/payment/moolre/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNum })
      });
      const result = await res.json();
      if (result.success && result.payment_status === 'paid') {
        const updated = await refreshOrder().catch(() => null);
        if (updated) setOrder(updated);
      }
    } catch (err) {
      console.error('[Success] Payment verification failed:', err);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center bg-white text-[#2B211B]">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 rounded-full border-[3px] border-[#E4DDD3] border-t-[#5B4436] animate-spin" aria-hidden="true"></span>
          <p className="text-[#4E423A]">Loading your order…</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center bg-white text-[#2B211B] px-4">
        <div className="max-w-sm text-center flex flex-col items-center gap-3">
          <i className="ri-error-warning-line text-4xl text-[#5B4436]"></i>
          <h1 className="font-serif font-medium text-3xl">We couldn’t find that order</h1>
          <p className="text-[#4E423A]">Check the link in your text message, or track it with your order number.</p>
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            <Link href="/order-tracking" className="h-12 px-5 inline-flex items-center rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white font-semibold transition-colors">Track an order</Link>
            <Link href="/shop" className="h-12 px-5 inline-flex items-center rounded-[14px] border-[1.5px] border-[#5B4436] font-semibold hover:bg-[#F7F4EF] transition-colors">Back to shop</Link>
          </div>
        </div>
      </main>
    );
  }

  const isPaid = order.payment_status === 'paid';
  const firstName = order.shipping_address?.firstName || order.metadata?.first_name || '';
  const promise = deliveryPromise(order);
  const isPickup = order.shipping_method === 'pickup';
  const channel = order.metadata?.payment_channel === 'card' ? 'Card' : order.metadata?.payment_channel === 'momo' ? 'Mobile Money' : null;
  // Older delivery orders were placed with no fee and priced by phone afterwards
  const feePending = order.metadata?.delivery_fee_pending ?? (
    order.shipping_method !== 'pickup' && Number(order.shipping_total) === 0
  );
  const placedAt = new Date(order.created_at);
  const placedLabel = `${placedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${placedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  const address = order.shipping_address || {};
  const items: any[] = order.order_items || [];

  return (
    <main className="min-h-screen bg-white text-[#2B211B]">
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 lg:px-10 pt-10 lg:pt-16 pb-20 lg:pb-24 flex flex-col gap-9 lg:gap-10">

        {/* Status */}
        {verifying ? (
          <div className="flex flex-col gap-3.5 items-start">
            <span className="w-14 h-14 rounded-full bg-[#F7F4EF] flex items-center justify-center"><span className="w-7 h-7 rounded-full border-[3px] border-[#E4DDD3] border-t-[#5B4436] animate-spin" aria-hidden="true"></span></span>
            <h1 className="font-serif font-medium text-[36px] lg:text-[48px] leading-[1.05] tracking-[-0.01em]">Confirming your payment…</h1>
            <p className="text-base lg:text-[17px] text-[#4E423A] max-w-[56ch]" aria-live="polite">This usually takes a few seconds. Please keep this page open.</p>
            <span className="text-sm text-[#4E423A]">Order <strong className="text-[#2B211B] tabular-nums">{order.order_number}</strong></span>
          </div>
        ) : isPaid ? (
          <div className="flex flex-col gap-3.5 items-start">
            <span className="w-14 h-14 rounded-full bg-[#E3F0E7] text-[#1F5A37] flex items-center justify-center"><i className="ri-check-line text-3xl"></i></span>
            <h1 className="font-serif font-medium text-[36px] lg:text-[48px] leading-[1.05] tracking-[-0.01em]">Thank you{firstName ? `, ${firstName}` : ''}</h1>
            <p className="text-base lg:text-[17px] text-[#4E423A] max-w-[56ch]">
              Your payment of <strong className="text-[#2B211B]">{money(order.total)}</strong> is confirmed. Updates go to {order.phone}{order.email ? ` and ${order.email}` : ''}.
            </p>
            <span className="text-sm text-[#4E423A]">Order number <strong className="text-[#2B211B] tabular-nums">{order.order_number}</strong></span>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 items-start">
            <span className="w-14 h-14 rounded-full bg-[#FBF1E6] text-[#8A4B1F] flex items-center justify-center"><i className="ri-time-line text-3xl"></i></span>
            <h1 className="font-serif font-medium text-[36px] lg:text-[48px] leading-[1.05] tracking-[-0.01em]">Your payment isn’t finished</h1>
            <p className="text-base lg:text-[17px] text-[#4E423A] max-w-[56ch]">
              We saved your order, but we haven’t received the payment of <strong className="text-[#2B211B]">{money(order.total)}</strong> yet. If money left your account, it can take a few minutes to show here.
            </p>
            <span className="text-sm text-[#4E423A]">Order <strong className="text-[#2B211B] tabular-nums">{order.order_number}</strong></span>
            <div className="flex gap-3 flex-wrap mt-2">
              <Link href={`/pay/${encodeURIComponent(order.order_number)}`} className="h-[54px] px-7 rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white font-semibold inline-flex items-center transition-colors">Pay {money(order.total)} now</Link>
              <button type="button" onClick={() => window.location.reload()} className="h-[54px] px-7 rounded-[14px] border-[1.5px] border-[#5B4436] font-semibold hover:bg-[#F7F4EF] transition-colors cursor-pointer">I’ve paid, check again</button>
            </div>
          </div>
        )}

        {/* Progress */}
        {isPaid && (
          <ol aria-label="Order progress" className="grid grid-cols-3 gap-3">
            <li className="flex flex-col gap-2.5">
              <span className="h-1 rounded-full bg-[#5B4436]"></span>
              <span className="text-sm font-semibold">Paid</span>
              <span className="text-[13px] text-[#4E423A]">{placedLabel}</span>
            </li>
            <li className="flex flex-col gap-2.5">
              <span className="h-1 rounded-full bg-[#E4DDD3]"></span>
              <span className="text-sm font-semibold">Packing</span>
              <span className="text-[13px] text-[#4E423A]">We text you when it starts</span>
            </li>
            <li className="flex flex-col gap-2.5">
              <span className="h-1 rounded-full bg-[#E4DDD3]"></span>
              <span className="text-sm font-semibold">{promise.title}</span>
              <span className="text-[13px] text-[#4E423A]">{promise.window}</span>
            </li>
          </ol>
        )}

        {/* Delivery + payment */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-[#F7F4EF] rounded-2xl p-5 flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-[15px]">{isPickup ? 'Store pickup' : order.shipping_method === 'outside_accra' ? 'Delivery outside Accra' : 'Doorstep delivery'}</span>
            <span className="text-[#2B211B] font-medium">{promise.window} · by {promise.by}</span>
            {isPickup ? (
              <span className="text-[#4E423A]">We text you when it’s ready to collect. Bring your order number.</span>
            ) : (
              <>
                {address.address && <span className="text-[#4E423A]">{address.address}</span>}
                {(address.city || address.region) && <span className="text-[#4E423A]">{[address.city, address.region].map((v: any) => String(v || '').trim()).filter(Boolean).join(', ')}</span>}
                {address.gpsAddress && <span className="text-[#4E423A]">GPS {address.gpsAddress}</span>}
                {feePending && <span className="text-[#8A4B1F]">We’ll contact you with the delivery fee before we send it.</span>}
              </>
            )}
          </div>
          <div className="bg-[#F7F4EF] rounded-2xl p-5 flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-[15px]">Payment</span>
            <span className="text-[#4E423A]">{channel ? `${channel} through Moolre` : 'Through Moolre'}</span>
            <span className={isPaid ? 'text-[#1F5A37] font-medium' : 'text-[#8A4B1F] font-medium'}>{isPaid ? `Paid ${money(order.total)}` : `Waiting for ${money(order.total)}`}</span>
          </div>
        </div>

        {/* Items */}
        <div className="flex flex-col gap-3.5 border-t border-[#EFEAE3] pt-6">
          {items.map((item: any) => (
            <div key={item.id} className="flex gap-3.5 items-center">
              <div className="w-14 h-[66px] flex-none bg-[#F7F4EF] rounded-[10px] overflow-hidden">
                {item.metadata?.image && <img src={item.metadata.image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-semibold line-clamp-1">{item.product_name}</p>
                <p className="text-[#4E423A]">{[item.variant_name?.replace(' / ', ' · '), `×${item.quantity}`].filter(Boolean).join(' · ')}</p>
                {item.metadata?.preorder_shipping && <p className="text-xs text-[#8A4B1F] mt-0.5">{item.metadata.preorder_shipping}</p>}
              </div>
              <span className="text-sm font-semibold tabular-nums">{money(item.total_price ?? item.unit_price * item.quantity)}</span>
            </div>
          ))}
          <dl className="flex flex-col gap-2 text-sm tabular-nums border-t border-[#EFEAE3] pt-3.5">
            <div className="flex justify-between"><dt className="text-[#4E423A]">Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
            {Number(order.discount_total) > 0 && <div className="flex justify-between text-[#1F5A37]"><dt>Savings</dt><dd>−{money(order.discount_total)}</dd></div>}
            <div className="flex justify-between"><dt className="text-[#4E423A]">{isPickup ? 'Store pickup' : 'Delivery'}</dt><dd>{feePending ? 'To be confirmed' : Number(order.shipping_total) > 0 ? money(order.shipping_total) : 'Free'}</dd></div>
            <div className="flex justify-between text-base font-bold border-t border-[#EFEAE3] pt-3"><dt>{isPaid ? 'Total paid' : 'Total'}</dt><dd>{money(order.total)}</dd></div>
          </dl>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link href={`/order-tracking?order=${encodeURIComponent(order.order_number)}${order.email ? `&email=${encodeURIComponent(order.email)}` : ''}`} className="h-[54px] px-7 rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white font-semibold inline-flex items-center transition-colors">Track your order</Link>
          <Link href="/shop" className="h-[54px] px-7 rounded-[14px] border-[1.5px] border-[#5B4436] font-semibold hover:bg-[#F7F4EF] inline-flex items-center transition-colors">Continue shopping</Link>
        </div>

        <div className="flex flex-col gap-2 text-sm text-[#4E423A]">
          {!order.user_id && (
            <p>Want faster checkout next time? <Link href="/auth/signup" className="text-[#5B4436] font-semibold underline underline-offset-[3px]">Save your details with a password</Link></p>
          )}
          <p>Questions about your order? <Link href="/contact" className="text-[#5B4436] font-semibold underline underline-offset-[3px]">Contact us</Link> or see our <Link href="/returns" className="text-[#5B4436] font-semibold underline underline-offset-[3px]">returns policy</Link>.</p>
        </div>
      </div>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-[3px] border-[#E4DDD3] border-t-[#5B4436] animate-spin" aria-hidden="true"></span>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
