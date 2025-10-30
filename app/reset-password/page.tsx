'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!pw || pw !== pw2) { setMsg('Passwords must match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg('Password updated. Redirecting…');
    setTimeout(()=>{ window.location.href = '/'; }, 800);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center justify-center p-6">
      <form onSubmit={save} className="w-full space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold">Set new password</h1>
        {msg && <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-sm">{msg}</div>}
        <div>
          <div className="text-xs text-gray-500">New password</div>
          <input type="password" className="w-full rounded-md border px-3 py-2" value={pw} onChange={(e)=>setPw(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Confirm password</div>
          <input type="password" className="w-full rounded-md border px-3 py-2" value={pw2} onChange={(e)=>setPw2(e.target.value)} />
        </div>
        <button type="submit" disabled={busy} className="w-full rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </main>
  );
}
