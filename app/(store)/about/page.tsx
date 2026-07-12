'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import AnimatedSection, { AnimatedGrid } from '@/components/AnimatedSection';

type ValueCard = {
  icon: string;
  title: string;
  body: string;
};

type JourneyStep = {
  label: string;
  title: string;
  body: string;
};

export default function AboutPage() {
  usePageTitle('Our Story');
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'Faithlinegh';

  const valueCards: ValueCard[] = [
    {
      icon: 'ri-eye-line',
      title: 'Transparency first',
      body: "We believe in honest pricing, clear communication, and no hidden costs — so you always know exactly what you're getting.",
    },
    {
      icon: 'ri-shield-check-line',
      title: 'Quality you can trust',
      body: 'Every piece is carefully selected and checked to make sure it meets our standards before it reaches you.',
    },
    {
      icon: 'ri-hand-heart-line',
      title: 'Customers come first',
      body: "We don't just fulfil orders — we build trust with every customer, one delivery at a time.",
    },
  ];

  const journeySteps: JourneyStep[] = [
    {
      label: '01',
      title: 'Browse & choose',
      body: 'Explore our collection of bags, basics and dresses, and add your favourite pieces to your cart.',
    },
    {
      label: '02',
      title: 'Order & pay',
      body: 'Check out securely in a few taps. We confirm your order and get it ready for delivery.',
    },
    {
      label: '03',
      title: 'Nationwide delivery',
      body: 'We deliver right to your doorstep anywhere in Ghana, with order updates along the way.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="border-b border-brand-carton/15 bg-[#F4F2F1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <AnimatedSection className="lg:col-span-6" animation="fade-up">
              <p className="text-xs font-semibold tracking-[0.25em] uppercase text-brand-brown">
                About {siteName}
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-gray-900">
                Effortless Style. Elevated Essentials. Curated for You.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-gray-700 max-w-xl leading-relaxed">
                At Faithlinegh, we believe style should be seamless. We hand-select each piece — from our
                structured bags to our clothings — to ensure you feel confident and put-together, every day.
                We don&apos;t just sell fashion; we help you build a wardrobe you love, delivered anywhere in Ghana.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-brown border border-brand-carton/20">
                  <i className="ri-map-pin-line mr-2" /> Based in Accra, Ghana
                </span>
                <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-brown border border-brand-carton/20">
                  <i className="ri-truck-line mr-2" /> Nationwide delivery
                </span>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/shop"
                  className="inline-flex items-center rounded-full bg-brand-brown px-7 py-3 text-sm font-semibold text-white hover:bg-[#47362C] transition-colors"
                >
                  Browse products
                  <i className="ri-arrow-right-up-line ml-2" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center rounded-full border border-brand-carton/35 bg-white px-7 py-3 text-sm font-semibold text-brand-brown hover:bg-brand-cream transition-colors"
                >
                  Contact our team
                </Link>
              </div>
            </AnimatedSection>

            <AnimatedSection className="lg:col-span-6" animation="fade-left">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="relative overflow-hidden rounded-2xl aspect-[4/5] border border-brand-carton/15 bg-white shadow-sm">
                  <Image
                    src="/about-founder.png"
                    alt="Faithlinegh founder"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 50vw, 33vw"
                    priority
                  />
                </div>
                <div className="relative overflow-hidden rounded-2xl aspect-[4/5] border border-brand-carton/15 bg-brand-cream mt-8 shadow-sm">
                  <Image
                    src="/about-brand.png"
                    alt="Faithlinegh — affordable bags, basics and dresses"
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 50vw, 33vw"
                    priority
                  />
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      <AnimatedSection className="py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-brand-carton">
              Our core values
            </p>
            <h2 className="mt-1.5 text-xl sm:text-2xl font-extrabold text-brand-brown tracking-tight">
              Built on trust, driven by quality.
            </h2>
          </div>

          <AnimatedGrid className="mt-5 grid gap-3 md:grid-cols-3" staggerDelay={120}>
            {valueCards.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-brand-carton/15 bg-white p-4 sm:p-5 shadow-sm"
              >
                <div className="mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-carton text-white">
                  <i className={`${item.icon} text-base`} />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-brand-brown">{item.title}</h3>
                <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-gray-600">{item.body}</p>
              </div>
            ))}
          </AnimatedGrid>
        </div>
      </AnimatedSection>

      <section className="bg-white py-8 sm:py-10 border-b border-brand-carton/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-brand-carton/15 bg-brand-cream/40 p-4 sm:p-5">
              <div className="mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-brown text-white">
                <i className="ri-lightbulb-line text-base" />
              </div>
              <p className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-brand-carton mb-1.5">Our Vision</p>
              <h3 className="text-sm sm:text-base font-semibold text-brand-brown mb-1.5">
                Making quality accessible
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-gray-600">
                To make luxury, quality and functionality easily accessible — without breaking the bank.
              </p>
            </div>
            <div className="rounded-xl border border-brand-carton/15 bg-brand-cream/40 p-4 sm:p-5">
              <div className="mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-brown text-white">
                <i className="ri-compass-3-line text-base" />
              </div>
              <p className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-brand-brown mb-1.5">Our Mission</p>
              <h3 className="text-sm sm:text-base font-semibold text-brand-brown mb-1.5">
                Your go-to fashion store
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-gray-600">
                To become Ghana&apos;s trusted destination for stylish, affordable fashion — delivering quality pieces and dependable service, one order at a time.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-cream/45 py-8 sm:py-10 border-y border-brand-carton/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-brand-brown">
              How it works
            </p>
            <h2 className="mt-1.5 text-xl sm:text-2xl font-extrabold text-brand-brown tracking-tight">
              From cart to your doorstep.
            </h2>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {journeySteps.map((step) => (
              <div
                key={step.label}
                className="rounded-xl border border-brand-carton/15 bg-white p-4 sm:p-5"
              >
                <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-brand-carton">
                  Step {step.label}
                </span>
                <h3 className="mt-2 text-sm sm:text-base font-semibold text-brand-brown">{step.title}</h3>
                <p className="mt-1.5 text-xs sm:text-sm text-gray-600 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#5B4436] via-[#5B4436] to-[#5B4436] text-white border border-[#5B4436]/30 shadow-[0_16px_45px_rgba(91,68,54,0.2)] flex flex-col md:flex-row md:items-stretch md:max-h-[200px]">
            <div className="relative w-full md:w-3/5 px-4 sm:px-6 py-4 sm:py-5 flex flex-col justify-center gap-1.5 sm:gap-2 text-center md:text-left">
              <span className="inline-flex items-center justify-center md:justify-start text-[9px] sm:text-[10px] font-semibold tracking-[0.22em] uppercase text-white/80">
                Shop with {siteName}
              </span>
              <h3 className="text-base sm:text-lg md:text-xl font-extrabold leading-tight">
                Refined fashion delivered to your doorstep. Explore our curated collection.
              </h3>
              <div className="pt-0.5 sm:pt-1 flex flex-wrap gap-2 justify-center md:justify-start">
                <Link
                  href="/shop"
                  className="inline-flex items-center rounded-full bg-white text-[#5B4436] px-5 sm:px-6 py-1.5 sm:py-2 text-[11px] sm:text-sm font-semibold shadow-lg hover:bg-[#F3F3F3] transition-colors"
                >
                  Start shopping
                  <i className="ri-arrow-right-up-line ml-1.5 sm:ml-2" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 sm:px-5 py-1.5 sm:py-2 text-[11px] sm:text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  Talk to us
                </Link>
              </div>
            </div>
            <div className="relative w-full md:w-2/5 min-h-[10rem] sm:min-h-[12rem] md:min-h-0 overflow-hidden md:rounded-r-2xl sm:md:rounded-r-3xl rounded-b-2xl sm:rounded-b-3xl md:rounded-bl-none">
              <Image
                src="/category-bags.png"
                alt="Faithlinegh — quality fashion bags"
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
