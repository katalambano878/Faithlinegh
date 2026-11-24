'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { imgSrc } from '@/lib/img';
import { useCMS } from '@/context/CMSContext';

export default function ReturnsPortalPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
  const [details, setDetails] = useState('');
  const { getSetting } = useCMS();
  const phone = getSetting('contact_phone') || '0541770961';
  const whatsappDigits = phone.replace(/\D/g, '').replace(/^0/, '233');
  const [isLoading, setIsLoading] = useState(false);
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [lookupError, setLookupError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // All purchases are final: only problems caused on our side can be reported
  // (Returns & Exchanges policy).
  const reasons = [
    'Damaged item',
    'Defective item',
    'Incorrect item (not what I ordered)',
  ];

  const handleFindOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLookupError('');
    try {
      const { data, error } = await supabase.rpc('get_order_for_tracking', {
        p_order_number: orderNumber.trim(),
        p_email: email.trim(),
      });

      if (error || !data) {
        setLookupError('We could not find that order. Check the order number and the email you used at checkout.');
        return;
      }

      if (!['delivered', 'completed'].includes(data.status)) {
        setLookupError(`This order is still "${String(data.status).replace(/_/g, ' ')}" — returns can only be started once your order has been delivered.`);
        return;
      }

      const items = (data.order_items || []).map((item: any) => ({
        id: item.id,
        name: item.product_name + (item.variant_name ? ` (${item.variant_name})` : ''),
        price: Number(item.unit_price) || 0,
        quantity: item.quantity,
        image: item.metadata?.image || '/placeholder-product.svg',
      }));

      if (items.length === 0) {
        setLookupError('No returnable items were found on this order.');
        return;
      }

      setFoundOrder({
        id: data.order_number,
        date: new Date(data.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        items,
      });
      setSelectedItems([]);
      setReturnReasons({});
      setStep(2);
    } catch {
      setLookupError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSubmitReturn = async () => {
    setIsLoading(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          email: email.trim(),
          returnType: 'review',
          description: details.trim(),
          items: selectedItems.map(id => ({
            order_item_id: id,
            reason: returnReasons[id],
            quantity: foundOrder.items.find((i: any) => i.id === id)?.quantity || 1,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit return request');
      }
      router.push(`/returns/confirmation?order=${encodeURIComponent(json.order_number || orderNumber.trim())}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Returns &amp; Exchanges</h1>
          <p className="text-gray-600 mb-8 max-w-[62ch]">
            At Faithline, we carefully check and package every order before dispatch. Please take a moment to review our Returns &amp; Exchanges Policy before placing your order.
          </p>

          <section aria-label="Returns and exchanges policy" className="mb-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[#F7F4EF] p-5">
              <h2 className="font-semibold text-gray-900 mb-2">Refund policy</h2>
              <p className="text-sm text-gray-700 leading-relaxed">All purchases are final. We do not offer refunds for change of mind, incorrect size selection or personal preference.</p>
              <p className="text-sm text-gray-700 leading-relaxed mt-2">If an item is damaged, defective or incorrect due to an error on our part, we will review the matter and provide an appropriate resolution where applicable.</p>
            </div>
            <div className="rounded-xl bg-[#F7F4EF] p-5">
              <h2 className="font-semibold text-gray-900 mb-2">Exchange policy</h2>
              <p className="text-sm text-gray-700 leading-relaxed">We do not offer exchanges for size-related issues, change of mind or personal preference. To help you choose the best fit, please review our size guide and contact us for sizing help before you order.</p>
              <p className="text-sm text-gray-700 leading-relaxed mt-2">Exchanges or replacements are only considered when Faithline has supplied an incorrect, damaged or defective item.</p>
            </div>
            <div className="rounded-xl border-2 border-[#5B4436]/25 p-5 sm:col-span-2">
              <h2 className="font-semibold text-gray-900 mb-2">Damaged or incorrect items</h2>
              <p className="text-sm text-gray-700 leading-relaxed">If you receive a damaged, defective or incorrect item, contact us <strong>within 24 hours of delivery</strong>. Include your order details and clear photographs of the item so our team can review the issue promptly. Please keep the item unworn, unwashed and in its original condition while it is being assessed. After reviewing the information, our team will contact you with the appropriate resolution.</p>
              <p className="text-xs text-gray-500 mt-3">By completing a purchase, you acknowledge and agree to Faithline&apos;s Returns &amp; Exchanges Policy.</p>
            </div>
          </section>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Report a damaged or incorrect item</h2>
          <p className="text-gray-600 mb-6">Find your order, tell us what&apos;s wrong, then send us clear photos.</p>

          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center flex-1">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
                    i <= step ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {i < step ? <i className="ri-check-line"></i> : i}
                  </div>
                  {i < 3 && (
                    <div className={`flex-1 h-1 mx-4 ${
                      i < step ? 'bg-brand-brown' : 'bg-gray-200'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-sm font-semibold text-gray-900">Find Order</span>
              <span className="text-sm font-semibold text-gray-900">Select Items</span>
              <span className="text-sm font-semibold text-gray-900">Submit</span>
            </div>
          </div>

          {step === 1 && (
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Find Your Order</h2>
              <form onSubmit={handleFindOrder} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Order Number *
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-brown focus:border-brand-brown"
                    placeholder="ORD-2024-156"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-brown focus:border-brand-brown"
                    placeholder="Email address"
                    required
                  />
                </div>

                {lookupError && (
                  <div className="bg-[#E6DFD5] border border-[#5B4436]/30 rounded-lg p-4 text-sm text-[#5B4436]">
                    <i className="ri-error-warning-line mr-2"></i>
                    {lookupError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-brown hover:bg-brand-bag-dark text-white py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isLoading ? 'Finding Order...' : 'Find Order'}
                </button>
              </form>

              <div className="mt-8 p-4 bg-[#5B4436]/5 border border-[#5B4436]/20 rounded-lg">
                <div className="flex items-start space-x-3">
                  <i className="ri-information-line text-xl text-[#5B4436] mt-0.5" aria-hidden="true"></i>
                  <div className="text-sm text-[#5B4436]">
                    <p className="font-semibold mb-1">Before you start</p>
                    <ul className="space-y-1">
                      <li>• Report within 24 hours of delivery</li>
                      <li>• Have clear photos of the item ready</li>
                      <li>• Keep the item unworn, unwashed and in its original condition</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && foundOrder && (
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Which items have a problem?</h2>
              
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Order #{foundOrder.id} • Placed on {foundOrder.date}
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {foundOrder.items.map((item: any) => (
                  <div key={item.id} className="border-2 border-gray-200 rounded-lg p-4">
                    <div className="flex items-start space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="mt-1 w-5 h-5 text-gray-900 rounded border-gray-300 focus:ring-brand-brown"
                      />
                      <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                        <img {...imgSrc(item.image, '96px', 256)} loading="lazy" decoding="async" alt={item.name} className="w-full h-full object-cover object-top" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">{item.name}</p>
                        <p className="text-lg font-bold text-gray-900 mb-3">₵{item.price.toFixed(2)}</p>
                        
                        {selectedItems.includes(item.id) && (
                          <div className="mt-4">
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                              What&apos;s wrong? *
                            </label>
                            <select
                              value={returnReasons[item.id] || ''}
                              onChange={(e) => setReturnReasons({
                                ...returnReasons,
                                [item.id]: e.target.value
                              })}
                              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-brown focus:border-brand-brown pr-8"
                              required
                            >
                              <option value="">Select a reason</option>
                              {reasons.map((reason) => (
                                <option key={reason} value={reason}>{reason}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-8">
                <label htmlFor="problem-details" className="block text-sm font-semibold text-gray-900 mb-2">
                  Describe the problem *
                </label>
                <textarea
                  id="problem-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="For example: the bag strap arrived torn, or I received a black top instead of the white one I ordered."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-brown focus:border-brand-brown"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={selectedItems.length === 0 || !selectedItems.every(id => returnReasons[id]) || details.trim().length < 5}
                  className="flex-1 py-4 bg-brand-brown hover:bg-brand-bag-dark text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Review & Submit</h2>

              <div className="mb-8">
                <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
                <p className="text-sm text-gray-700 mb-3 whitespace-pre-line">{details}</p>
                <div className="space-y-3">
                  {foundOrder.items
                    .filter((item: any) => selectedItems.includes(item.id))
                    .map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-600">Reason: {returnReasons[item.id]}</p>
                        </div>
                        <p className="font-bold text-gray-900">₵{item.price.toFixed(2)}</p>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mb-8 p-6 border-2 border-gray-200 bg-gray-100 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Next steps</h3>
                <ol className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold">1.</span>
                    <span>Send clear photos of the item, with your order number, to us on WhatsApp (<a className="underline" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">{phone}</a>)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold">2.</span>
                    <span>Keep the item unworn, unwashed and in its original condition</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold">3.</span>
                    <span>Our team reviews the issue and contacts you with the appropriate resolution</span>
                  </li>
                </ol>
              </div>

              {submitError && (
                <div className="mb-6 bg-[#E6DFD5] border border-[#5B4436]/30 rounded-lg p-4 text-sm text-[#5B4436]">
                  <i className="ri-error-warning-line mr-2"></i>
                  {submitError}
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitReturn}
                  disabled={isLoading}
                  className="flex-1 py-4 bg-brand-brown hover:bg-brand-bag-dark text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isLoading ? 'Sending...' : 'Send report'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
  );
}
