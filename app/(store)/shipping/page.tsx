import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Shipping & Delivery',
  description: `${SITE_NAME} delivery: free store pickup, doorstep delivery in Accra and delivery across Ghana within 48 hours.`,
  path: '/shipping',
  keywords: ['delivery Ghana', 'delivery Accra', 'store pickup Accra', 'nationwide delivery Ghana'],
});

const OPTIONS = [
  {
    title: 'Store pickup',
    price: 'Free',
    timing: 'Ready within 24 hours',
    detail: 'We text you when your order is ready to collect. Bring your order number.',
    icon: 'ri-store-2-line',
  },
  {
    title: 'Doorstep delivery in Accra',
    price: 'Fee confirmed by our team',
    timing: 'Within 48 hours',
    detail: 'Delivered to the address and landmark you give at checkout.',
    icon: 'ri-truck-line',
  },
  {
    title: 'Delivery outside Accra',
    price: 'Fee confirmed by our team',
    timing: 'Within 48 hours',
    detail: 'Sent to your nearest bus station (VIP, STC) or courier office. We text you the pickup details.',
    icon: 'ri-map-pin-line',
  },
];

const STEPS = [
  { title: 'You order and pay', detail: 'Pay for your items with Mobile Money or card. You get your order number straight away.' },
  { title: 'We confirm delivery', detail: 'For delivery orders, we contact you with the fee for your area before we send anything.' },
  { title: 'We pack your order', detail: 'You get a text when it is ready to collect or on its way.' },
  { title: 'It reaches you', detail: 'Pickup within 24 hours, delivery within 48 hours.' },
];

export default function ShippingPage() {
  return (
    <main className="min-h-screen bg-white text-[#2B211B]">
      <div className="max-w-[880px] mx-auto px-4 sm:px-6 lg:px-10 pt-12 lg:pt-20 pb-20 lg:pb-28 flex flex-col gap-14 lg:gap-16">
        <header className="flex flex-col gap-4 max-w-[60ch]">
          <h1 className="font-serif font-medium text-[38px] lg:text-[52px] leading-[1.05] tracking-[-0.01em] text-balance">Delivery and pickup</h1>
          <p className="text-[17px] leading-relaxed text-[#4E423A]">
            Collect from our store for free, or have your order delivered in Accra or anywhere in Ghana. Orders arrive within 48 hours.
          </p>
        </header>

        <section aria-labelledby="options-h" className="flex flex-col gap-5">
          <h2 id="options-h" className="font-serif font-medium text-[26px] lg:text-[30px]">Your options</h2>
          <ul className="flex flex-col divide-y divide-[#EFEAE3] border-y border-[#EFEAE3]">
            {OPTIONS.map(option => (
              <li key={option.title} className="py-6 flex gap-4 sm:gap-5 items-start">
                <span className="w-11 h-11 flex-none rounded-full bg-[#F7F4EF] text-[#5B4436] flex items-center justify-center">
                  <i className={`${option.icon} text-xl`} aria-hidden="true"></i>
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                    <h3 className="font-semibold text-[17px]">{option.title}</h3>
                    <span className={`text-sm font-semibold ${option.price === 'Free' ? 'text-[#1F5A37]' : 'text-[#4E423A]'}`}>{option.price}</span>
                  </div>
                  <span className="text-sm font-medium text-[#2B211B]">{option.timing}</span>
                  <p className="text-sm leading-relaxed text-[#4E423A] max-w-[62ch]">{option.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="fees-h" className="bg-[#F7F4EF] rounded-[20px] p-6 sm:p-8 flex flex-col gap-3">
          <h2 id="fees-h" className="font-serif font-medium text-[24px] lg:text-[26px]">How delivery fees work</h2>
          <p className="text-[15px] leading-relaxed text-[#4E423A] max-w-[62ch]">
            At checkout you pay for your items only. The delivery fee depends on where you are, so our team contacts you with the fee for your area before we send your order.
          </p>
        </section>

        <section aria-labelledby="steps-h" className="flex flex-col gap-6">
          <h2 id="steps-h" className="font-serif font-medium text-[26px] lg:text-[30px]">After you order</h2>
          <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 items-start">
                <span className="w-8 h-8 flex-none rounded-full bg-[#F7F4EF] text-[#5B4436] font-bold text-sm flex items-center justify-center tabular-nums">{i + 1}</span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-[#4E423A]">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="help-h" className="flex flex-col gap-4 border-t border-[#EFEAE3] pt-10">
          <h2 id="help-h" className="font-serif font-medium text-[24px] lg:text-[26px]">Track, return or ask</h2>
          <p className="text-[15px] leading-relaxed text-[#4E423A] max-w-[62ch]">
            Track any order with its number. Items can be returned within 7 days; see the returns policy for details.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/order-tracking" className="h-12 px-6 rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white font-semibold inline-flex items-center transition-colors">Track your order</Link>
            <Link href="/returns" className="h-12 px-6 rounded-[14px] border-[1.5px] border-[#5B4436] font-semibold inline-flex items-center hover:bg-[#F7F4EF] transition-colors">Returns policy</Link>
            <Link href="/contact" className="h-12 px-6 rounded-[14px] border-[1.5px] border-[#5B4436] font-semibold inline-flex items-center hover:bg-[#F7F4EF] transition-colors">Contact us</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
