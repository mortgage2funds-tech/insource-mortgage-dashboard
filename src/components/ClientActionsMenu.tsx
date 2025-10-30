'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type Role = 'admin' | 'assistant';
type Props = { clientId: string; isArchived: boolean; role?: Role; };

export default function ClientActionsMenu({ clientId, isArchived, role }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<'archive'|'unarchive'|'delete'|null>(null);
  const [resolvedRole, setResolvedRole] = useState<Role | null>(role ?? null);

  useEffect(() => {
    if (role) return;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      if (!uid) return;
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
      if (prof?.role) setResolvedRole(prof.role as Role);
    })();
  }, [role, supabase]);

  const canHardDelete = resolvedRole === 'admin';

  async function archiveClient() {
    try {
      setBusy('archive');
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('clients').update({
        is_archived: true, archived_at: new Date().toISOString(), archived_by: user?.id ?? null
      }).eq('id', clientId);
      if (error) throw error;
      router.refresh();
    } catch (e: any) { alert(`Could not archive: ${e.message ?? e}`); } finally { setBusy(null); }
  }

  async function unarchiveClient() {
    try {
      setBusy('unarchive');
      const { error } = await supabase.from('clients').update({
        is_archived: false, archived_at: null, archived_by: null
      }).eq('id', clientId);
      if (error) throw error;
      router.refresh();
    } catch (e: any) { alert(`Could not unarchive: ${e.message ?? e}`); } finally { setBusy(null); }
  }

  async function hardDeleteClient() {
    if (!canHardDelete) return;
    if (!confirm('Delete permanently? This cannot be undone.')) return;
    try {
      setBusy('delete');
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) throw error;
      router.refresh();
    } catch (e: any) { alert(`Could not delete: ${e.message ?? e}`); } finally { setBusy(null); }
  }

  return (
    <div className="relative">
      <details className="group">
        <summary className="cursor-pointer select-none rounded-xl border px-3 py-1 text-sm hover:shadow data-[busy=true]:opacity-60" data-busy={!!busy}>
          {busy ? 'Working…' : 'Actions'}
        </summary>
        <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg group-open:block hidden">
          {!isArchived ? (
            <button onClick={archiveClient} disabled={!!busy} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50">Archive</button>
          ) : (
            <button onClick={unarchiveClient} disabled={!!busy} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50">Unarchive</button>
          )}
          {canHardDelete && (
            <>
              <div className="my-1 h-px w-full bg-gray-200" />
              <button onClick={hardDeleteClient} disabled={!!busy} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600">Delete Permanently (Admin)</button>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
