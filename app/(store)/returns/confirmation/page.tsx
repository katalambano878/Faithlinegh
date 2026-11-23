'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCMS } from '@/context/CMSContext';

function Confirmation() {
  const order = useSearchParams().get('order') || '';
  const { getSetting } = useCMS();
  const phone = getSetting('contact_phone') || '0541770961';
  const whatsappDigits = phone.replace(/\D/g, '').replace(/^0/, '233');
  const message = encodeURIComponent(`Hi Faithline, I reported a problem with order ${order}. Here are photos of the item.`);

  return (
    <main className="min-h-screen bg-white flex items-center justify-center py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-6">
            <i className="ri-check-line text-3xl text-gray-900" aria-hidden="true"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3 text-center">We&apos;ve got your report</h1>
          {order && (
            <p className="text-center text-gray-600 mb-8">Order <span className="font-semibold text-gray-900">{order}</span></p>
          )}

          <h2 className="font-bold text-gray-900 mb-4">What happens next</h2>
          <ol className="space-y-4 mb-8">
            <li className="flex gap-4 items-start">
              <span className="w-8 h-8 flex-none rounded-full bg-gray-100 text-gray-900 font-bold text-sm flex items-center justify-center">1</span>
              <div>
                <p className="font-semibold text-gray-900">Send us clear photos</p>
                <p className="text-sm text-gray-600">Send photos of the item and your order number on WhatsApp, so our team can review the issue promptly.</p>
              </div>
            </li>
            <li className="flex gap-4 items-start">
              <span className="w-8 h-8 flex-none rounded-full bg-gray-100 text-gray-900 font-bold text-sm flex items-center justify-center">2</span>
              <div>
                <p className="font-semibold text-gray-900">Keep the item as it is</p>
                <p className="text-sm text-gray-600">Keep it unworn, unwashed and in its original condition while it&apos;s being assessed.</p>
              </div>
            </li>
            <li className="flex gap-4 items-start">
              <span className="w-8 h-8 flex-none rounded-full bg-gray-100 text-gray-900 font-bold text-sm flex items-center justify-center">3</span>
              <div>
                <p className="font-semibold text-gray-900">We contact you</p>
                <p className="text-sm text-gray-600">After reviewing the information, our team contacts you with the appropriate resolution.</p>
              </div>
            </li>
          </ol>

          <div className="space-y-3">
            <a
              href={`https://wa.me/${whatsappDigits}?text=${message}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-brand-bag-dark text-white py-4 rounded-lg font-semibold transition-colors"
            >
              <i className="ri-whatsapp-line text-lg" aria-hidden="true"></i>
              Send photos on WhatsApp
            </a>
            <Link
              href="/shop"
              className="block text-center w-full border-2 border-gray-300 hover:border-gray-400 text-gray-700 py-4 rounded-lg font-semibold transition-colors"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ReturnConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <Confirmation />
    </Suspense>
  );
}
