'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else window.location.href = '/';
  }

  async function sendReset() {
    if (!email) { setMsg('Enter your email above, then click “Forgot password?”'); return; }
    setMsg(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else setMsg('Reset link sent. Check your email.');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      <form onSubmit={signIn} className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="space-y-1">
          <label className="text-sm">Email</label>
          <input className="w-full rounded-xl border p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <input className="w-full rounded-xl border p-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>

        {msg && <div className="rounded-xl border bg-gray-50 p-2 text-sm">{msg}</div>}

        <div className="flex items-center justify-between">
          <button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-60">
            {busy ? 'Working…' : 'Sign in'}
          </button>

          <button type="button" onClick={sendReset} className="text-sm underline">Forgot password?</button>
        </div>
      </form>
    </main>
  );
}
