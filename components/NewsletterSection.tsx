'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/storefront/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
      setMessage("You're on the list! Watch your inbox for new arrivals and offers.");
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <section className="pb-7 sm:pb-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-brand-brown/10 px-6 sm:px-10 lg:px-16 py-12 sm:py-16 text-center">
          {/* soft decorative fields */}
          <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full bg-white/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-brand-brown/10 blur-3xl" />

          <div className="relative max-w-xl mx-auto">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.32em] text-brand-brown">
              Stay in the loop
            </p>
            <h2 className="mt-3 font-serif text-2xl sm:text-3xl lg:text-4xl font-normal leading-tight text-gray-900">
              Join our newsletter
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-600 leading-relaxed">
              Be the first to know about new arrivals, exclusive offers and style inspiration —
              delivered straight to your inbox.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 sm:mt-8">
              <div className="flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto">
                <label htmlFor="newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 rounded-full border border-brand-brown/20 bg-white px-5 py-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-brown/50 focus:ring-2 focus:ring-brand-brown/10 transition"
                  disabled={status === 'loading'}
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="shrink-0 inline-flex items-center justify-center rounded-full bg-brand-brown px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-bag-dark disabled:opacity-60"
                >
                  {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
                </button>
              </div>

              {message && (
                <p
                  className={`mt-4 text-sm ${
                    status === 'success' ? 'text-brand-brown font-medium' : 'text-red-700'
                  }`}
                  role="status"
                >
                  {message}
                </p>
              )}

              <p className="mt-4 text-[11px] text-gray-500">
                No spam — unsubscribe anytime.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
