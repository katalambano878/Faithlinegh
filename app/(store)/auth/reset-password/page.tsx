'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirm) return setError("The two passwords don't match");
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || 'Could not reset your password. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">This link is incomplete</h1>
        <p className="text-gray-600 mb-6">Open the link from your email again, or ask for a new one.</p>
        <Link href="/auth/forgot-password" className="inline-block bg-gray-900 hover:bg-brand-bag-dark text-white px-8 py-3 rounded-lg font-semibold transition-colors">
          Get a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-6">
          <i className="ri-check-line text-3xl text-gray-900" aria-hidden="true"></i>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Password updated</h1>
        <p className="text-gray-600 mb-8">You can now sign in with your new password.</p>
        <Link href="/auth/login" className="inline-block bg-gray-900 hover:bg-brand-bag-dark text-white px-8 py-3 rounded-lg font-semibold transition-colors">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-5">
          <img src="/logo.png" alt="Faithlinegh" className="h-10 mx-auto" />
        </Link>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Choose a new password</h1>
        <p className="text-gray-600">At least 6 characters.</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="new-password" className="block text-sm font-semibold text-gray-900 mb-2">New password</label>
            <div className="relative">
              <input
                id="new-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900"
              >
                <i className={show ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-900 mb-2">Type it again</label>
            <input
              id="confirm-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600"
            />
          </div>
          {error && <p className="text-sm text-[#5B4436]" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-900 hover:bg-brand-bag-dark text-white py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save new password'}
          </button>
        </form>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
