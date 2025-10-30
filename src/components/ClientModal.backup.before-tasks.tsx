'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import ClientActionsMenu from '@/components/ClientActionsMenu';
import { ClientForm, ClientRow } from '@/components/ClientForm';

type Note = {
  id: string;
  client_id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  author_name?: string | null;
};

export default function ClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: ClientRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<'details' | 'edit' | 'notes'>('details');
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(true);

  async function loadNotes() {
    setLoadingNotes(true);
    const { data } = await supabase
      .from('client_notes')
      .select('id, client_id, body, created_at, created_by')
      .eq('client_id', client.id!)
      .order('created_at', { ascending: false });
    const base = (data ?? []) as Note[];

    // Try to map author ids → names from profiles
    const userIds = Array.from(new Set(base.map(n => n.created_by).filter(Boolean))) as string[];
    let names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      (profs ?? []).forEach((p: any) => { names[p.id] = p.full_name || p.email || 'User'; });
    }
    setNotes(base.map(n => ({ ...n, author_name: n.created_by ? names[n.created_by] ?? 'User' : 'User' })));
    setLoadingNotes(false);
  }

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  async function addNote() {
    if (!newNote.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;
    const { error } = await supabase.from('client_notes').insert({
      client_id: client.id!,
      body: newNote.trim(),
      created_by: uid,
    });
    if (!error) {
      setNewNote('');
      await loadNotes();
    } else {
      alert('Could not add note.');
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-xl">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{client.name || '(No name)'}</div>
            <div className="text-xs text-gray-600">
              Stage: {client.stage ?? '—'} • Assigned: {client.assigned_to ?? '—'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ClientActionsMenu clientId={client.id!} isArchived={false} />
            <button
              onClick={() => setTab('edit')}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Edit
            </button>
            <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-3 flex items-center gap-2 text-sm">
          <button
            onClick={() => setTab('details')}
            className={`rounded-md border px-3 py-1.5 ${tab==='details' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            Details
          </button>
          <button
            onClick={() => setTab('notes')}
            className={`rounded-md border px-3 py-1.5 ${tab==='notes' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            Notes
          </button>
          <button
            onClick={() => setTab('edit')}
            className={`rounded-md border px-3 py-1.5 ${tab==='edit' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            Edit
          </button>
        </div>

        {/* Content */}
        {tab === 'details' && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Phone" value={client.phone ?? '—'} />
            <Info label="Email" value={client.email ?? '—'} />
            <Info label="Created Email" value={client.created_email ?? '—'} />
            <Info label="Type" value={client.file_type ?? '—'} />
            <Info label="Bank" value={client.bank ?? '—'} />
            <Info label="Banker" value={client.banker_name ?? '—'} />
            <Info label="Banker Email" value={client.banker_email ?? '—'} />
            <Info label="Lender" value={client.lender ?? '—'} />
            <Info label="Next follow-up" value={client.next_follow_up ?? '—'} />
            <Info label="Last contact" value={client.last_contact ?? '—'} />
            <Info label="Subject removal" value={client.subject_removal_date ?? '—'} />
            <Info label="Closing date" value={client.closing_date ?? '—'} />
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-3">
            <div className="rounded-xl border p-3">
              <div className="mb-2 text-sm font-medium">Add note</div>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="h-24 w-full rounded-md border p-2"
                placeholder="Type a note… (timestamp & author will be added automatically)"
              />
              <div className="mt-2 text-right">
                <button onClick={addNote} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white">
                  Add note
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {loadingNotes && <div className="text-sm text-gray-500">Loading notes…</div>}
              {!loadingNotes && notes.length === 0 && (
                <div className="rounded-xl border bg-gray-50 p-3 text-center text-sm text-gray-600">
                  No notes yet.
                </div>
              )}
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl border p-3">
                  <div className="mb-1 text-xs text-gray-500">
                    {new Date(n.created_at).toLocaleString()} — {n.author_name ?? 'User'}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{n.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'edit' && (
          <ClientForm
            client={client}
            onClose={(saved) => {
              if (saved) onSaved();
              setTab('details');
            }}
          />
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div>{value}</div>
    </div>
  );
}
