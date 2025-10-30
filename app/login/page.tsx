'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    window.location.href = '/';
  }

  async function sendReset() {
    if (!email) { setMsg('Enter your email first, then click “Forgot password?”'); return; }
    setMsg(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg('Password reset link sent. Check your email.');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center justify-center p-6">
      <form onSubmit={login} className="w-full space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold">Login</h1>
        {msg && <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-sm">{msg}</div>}
        <div>
          <div className="text-xs text-gray-500">Email</div>
          <input className="w-full rounded-md border px-3 py-2" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Password</div>
          <input type="password" className="w-full rounded-md border px-3 py-2" value={pw} onChange={(e)=>setPw(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <button type="submit" disabled={busy} className="rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
            {busy ? 'Working…' : 'Login'}
          </button>
          <button type="button" onClick={sendReset} className="text-sm text-blue-700 hover:underline">
            Forgot password?
          </button>
        </div>
      </form>
    </main>
  );
}
