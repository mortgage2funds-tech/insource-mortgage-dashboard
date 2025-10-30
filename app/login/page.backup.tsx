'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, go to dashboard
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) router.replace('/');
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message || 'Login failed');
      return;
    }
    router.replace('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        {/* Logo — fixed size so it always renders */}
        <div className="flex justify-center mb-6">
          <Image
            src="/insource-logo.png"
            alt="Insource"
            width={220}     // adjust if you want larger/smaller
            height={60}
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-lg font-semibold text-center mb-2">Insource Mortgage Dashboard</h1>
        <p className="text-sm text-gray-600 text-center mb-6">Please sign in</p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="text-gray-700">Email</span>
            <input
              type="email"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>

          <label className="block text-sm">
            <span className="text-gray-700">Password</span>
            <input
              type="password"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-center text-[11px] text-gray-500">
          Need help? Contact the admin.
        </div>
      </div>
    </div>
  );
}

