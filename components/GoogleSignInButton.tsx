'use client';

import { useEffect, useState } from 'react';

const ERRORS: Record<string, string> = {
  google_unavailable: 'Google sign-in is not available right now. Please use your email and password.',
  google_cancelled: 'Google sign-in was cancelled. You can try again or use your email.',
  google_expired: 'That sign-in took too long. Please press Continue with Google again.',
  google_unverified: 'Google could not confirm the email on that account. Try another Google account or use your email.',
  google_failed: 'We could not sign you in with Google. Please try again, or use your email and password.',
};

/** Friendly text for a ?error= code the Google sign-in sends back. */
export function googleErrorMessage(code: string | null): string {
  return code && ERRORS[code] ? ERRORS[code] : '';
}

/**
 * "Continue with Google" with its "or" divider. Shows nothing until Google
 * sign-in is switched on for the store.
 */
export default function GoogleSignInButton({ dividerLabel, redirect }: { dividerLabel: string; redirect?: string }) {
  const [enabled, setEnabled] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/providers')
      .then((r) => (r.ok ? r.json() : { google: false }))
      .then((d) => !cancelled && setEnabled(!!d.google))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  const target = (() => {
    if (redirect) return redirect;
    if (typeof window === 'undefined') return '/account';
    const r = new URLSearchParams(window.location.search).get('redirect') || '';
    return r.startsWith('/') && !r.startsWith('//') ? r : '/account';
  })();

  return (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">{dividerLabel}</span>
        </div>
      </div>

      <a
        href={`/api/auth/google?redirect=${encodeURIComponent(target)}`}
        onClick={() => setLeaving(true)}
        aria-busy={leaving}
        className={`mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white font-medium text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 ${
          leaving ? 'pointer-events-none opacity-70' : ''
        }`}
      >
        {leaving ? (
          <i className="ri-loader-4-line animate-spin text-lg" aria-hidden />
        ) : (
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
        )}
        {leaving ? 'Opening Google…' : 'Continue with Google'}
      </a>
    </div>
  );
}
