import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Shipping & Delivery',
  description: `${SITE_NAME} delivery: 1–2 business days in Accra and Greater Accra, 2–4 business days to other regions, and store pickup within 2 hours of payment.`,
  path: '/shipping',
  keywords: ['delivery Ghana', 'delivery Accra', 'store pickup Accra', 'nationwide delivery Ghana'],
});

const OPTIONS = [
  {
    title: 'Accra & Greater Accra',
    price: 'Fee shared after you order',
    timing: '1–2 business days',
    detail: 'Delivered by our delivery riders to the address and landmark you give at checkout.',
    icon: 'ri-truck-line',
  },
  {
    title: 'Other regions',
    price: 'Fee shared after you order',
    timing: '2–4 business days',
    detail: 'Sent through courier services. We text you the details when your order is on its way.',
    icon: 'ri-map-pin-line',
  },
  {
    title: 'Order pickup',
    price: 'Free',
    timing: 'Within 2 hours of payment',
    detail: 'Collect your order from our store within 2 hours after your payment is confirmed. Bring your order number.',
    icon: 'ri-store-2-line',
  },
];

const STEPS = [
  { title: 'You order and pay', detail: 'Pay for your items with Mobile Money or card. You get your order number straight away.' },
  { title: 'We share the delivery fee', detail: 'Delivery fees vary by location. We tell you the fee for your area after your order is placed and confirmed.' },
  { title: 'We pack your order', detail: 'Every order is checked and packaged before it leaves us. You get a text when it is ready or on its way.' },
  { title: 'It reaches you', detail: '1–2 business days in Accra, 2–4 business days elsewhere. Pickup orders are ready within 2 hours.' },
];

export default function ShippingPage() {
  return (
    <main className="min-h-screen bg-white text-[#2B211B]">
      <div className="max-w-[880px] mx-auto px-4 sm:px-6 lg:px-10 pt-12 lg:pt-20 pb-20 lg:pb-28 flex flex-col gap-14 lg:gap-16">
        <header className="flex flex-col gap-4 max-w-[60ch]">
          <h1 className="font-serif font-medium text-[38px] lg:text-[52px] leading-[1.05] tracking-[-0.01em] text-balance">Shipping &amp; delivery</h1>
          <p className="text-[17px] leading-relaxed text-[#4E423A]">
            We deliver across Ghana, Monday to Saturday. Orders in Accra and Greater Accra arrive in 1–2 business days, other regions in 2–4 business days, or you can collect from our store.
          </p>
        </header>

        <section aria-labelledby="options-h" className="flex flex-col gap-5">
          <h2 id="options-h" className="font-serif font-medium text-[26px] lg:text-[30px]">Delivery timeline</h2>
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

        <div className="grid sm:grid-cols-2 gap-4">
          <section aria-labelledby="schedule-h" className="bg-[#F7F4EF] rounded-[20px] p-6 sm:p-8 flex flex-col gap-3">
            <h2 id="schedule-h" className="font-serif font-medium text-[22px] lg:text-[24px]">Delivery schedule</h2>
            <p className="text-[15px] leading-relaxed text-[#4E423A]">
              Deliveries are available Monday to Saturday. We don&apos;t deliver on Sundays.
            </p>
          </section>
          <section aria-labelledby="fees-h" className="bg-[#F7F4EF] rounded-[20px] p-6 sm:p-8 flex flex-col gap-3">
            <h2 id="fees-h" className="font-serif font-medium text-[22px] lg:text-[24px]">Delivery fees</h2>
            <p className="text-[15px] leading-relaxed text-[#4E423A]">
              Delivery fees vary depending on your location. We tell you the fee for your area after your order has been placed and confirmed.
            </p>
          </section>
        </div>

        <section aria-labelledby="attempts-h" className="flex flex-col gap-3 border-l-[3px] border-[#5B4436] pl-5">
          <h2 id="attempts-h" className="font-serif font-medium text-[22px] lg:text-[24px]">Delivery attempts</h2>
          <p className="text-[15px] leading-relaxed text-[#4E423A] max-w-[62ch]">
            Please make sure your phone is reachable and someone is available to receive your order. Missed deliveries may attract an additional delivery fee.
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
          <h2 id="help-h" className="font-serif font-medium text-[24px] lg:text-[26px]">Track, report or ask</h2>
          <p className="text-[15px] leading-relaxed text-[#4E423A] max-w-[62ch]">
            Track any order with its number. All purchases are final. If an item arrives damaged, defective or incorrect, tell us within 24 hours of delivery.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/order-tracking" className="h-12 px-6 rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white font-semibold inline-flex items-center transition-colors">Track your order</Link>
            <Link href="/returns" className="h-12 px-6 rounded-[14px] border-[1.5px] border-[#5B4436] font-semibold inline-flex items-center hover:bg-[#F7F4EF] transition-colors">Returns &amp; exchanges</Link>
            <Link href="/contact" className="h-12 px-6 rounded-[14px] border-[1.5px] border-[#5B4436] font-semibold inline-flex items-center hover:bg-[#F7F4EF] transition-colors">Contact us</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
