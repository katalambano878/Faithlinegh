'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import GoogleSignInButton, { googleErrorMessage } from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const { getToken, verifying } = useRecaptcha();

  // Message when Google sign-in sends the customer back with an error
  useEffect(() => {
    const msg = googleErrorMessage(new URLSearchParams(window.location.search).get('error'));
    if (msg) setAuthError(msg);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAuthError('');
    setIsLoading(true);

    // Validation
    const newErrors: any = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    // reCAPTCHA verification
    const isHuman = await getToken('login');
    if (!isHuman) {
      setAuthError('Security verification failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        const r = new URLSearchParams(window.location.search).get('redirect') || '';
        router.push(r.startsWith('/') && !r.startsWith('//') ? r : '/account');
        router.refresh(); // Refresh to update auth state in other components
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setAuthError(error.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center py-8 px-4 sm:px-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-5">
          <Link href="/" className="inline-block mb-3">
            <img src="/logo.png" alt="Faithlinegh" className="h-8 mx-auto" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome Back</h1>
          <p className="text-sm text-gray-600">Sign in to your account to continue</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
          {authError && (
            <div className="mb-4 p-4 bg-[#E6DFD5]/50 border border-[#5B4436]/30 text-[#5B4436] rounded-lg text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 ${errors.email ? 'border-[#5B4436]' : 'border-gray-300'
                  }`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-sm text-[#5B4436] mt-2">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 ${errors.password ? 'border-[#5B4436]' : 'border-gray-300'
                    }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-[#5B4436] mt-2">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                  className="w-4 h-4 text-gray-700 rounded focus:ring-gray-600"
                />
                <span className="text-xs text-gray-700">Remember me</span>
              </label>
              <Link href="/auth/forgot-password" className="text-xs text-gray-900 hover:text-gray-900 font-medium whitespace-nowrap">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading || verifying}
              className="w-full bg-brand-brown hover:bg-[#47362C] text-white py-2.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer shadow-md shadow-brand-brown/20"
            >
              {isLoading || verifying ? (
                <span className="flex items-center justify-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i> {verifying ? 'Verifying...' : 'Signing in...'}
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <GoogleSignInButton dividerLabel="Or continue with" />

          <p className="mt-5 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-gray-900 hover:text-gray-900 font-semibold whitespace-nowrap">
              Create one now
            </Link>
          </p>
        </div>

        <div className="mt-5 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
