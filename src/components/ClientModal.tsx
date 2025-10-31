'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import TaskEditor from './TaskModal'; // keep this import path if your TaskModal is named TaskModal

import { ClientForm } from '@/components/ClientForm';

type Client = any;

export default function ClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<'details' | 'tasks' | 'notes' | 'edit'>('details');

  // Task list scoped to this client
  const [tasks, setTasks] = useState<any[]>([]);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  async function loadTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', client.id)
      .order('due_date', { ascending: true });
    setTasks(data ?? []);
  }
  useEffect(() => { if (tab === 'tasks') loadTasks(); }, [tab]); // eslint-disable-line

  // Notes (with author names)
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);

  async function loadNotes() {
    setLoadingNotes(true);
    const { data } = await supabase
      .from('client_notes')
      .select('id, client_id, body, created_at, created_by')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });

    const base = data ?? [];
    const ids = Array.from(new Set(base.map(n => n.created_by).filter(Boolean))) as string[];

    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      (profs ?? []).forEach((p: any) => { names[p.id] = p.full_name || p.email || 'User'; });
    }

    setNotes(base.map(n => ({ ...n, author_name: n.created_by ? (names[n.created_by] ?? 'User') : 'User' })));
    setLoadingNotes(false);
  }
  useEffect(() => { if (tab === 'notes') loadNotes(); }, [tab]); // eslint-disable-line

  async function addNote() {
    if (!newNote.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;
    const { error } = await supabase.from('client_notes').insert({
      client_id: client.id,
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
      <div className="max-w-3xl w-full max-h-[92vh] overflow-auto rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">{client?.name || 'Client'}</div>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">Close</button>
        </div>

        {/* Tabs */}
        <div className="mb-3 flex items-center gap-2">
          <button type="button" aria-current={tab==='details'?'page':undefined} className={`rounded-md border px-3 py-1.5 text-sm ${tab==='details'?'bg-[--brand] text-white':'bg-white hover:bg-gray-50'}`} onClick={()=>setTab('details')}>Details</button>
          <button type="button" aria-current={tab==='tasks'?'page':undefined} className={`rounded-md border px-3 py-1.5 text-sm ${tab==='tasks'?'bg-[--brand] text-white':'bg-white hover:bg-gray-50'}`} onClick={()=>setTab('tasks')}>Tasks</button>
          <button type="button" aria-current={tab==='notes'?'page':undefined} className={`rounded-md border px-3 py-1.5 text-sm ${tab==='notes'?'bg-[--brand] text-white':'bg-white hover:bg-gray-50'}`} onClick={()=>setTab('notes')}>Notes</button>
          <button type="button" aria-current={tab==='edit'?'page':undefined} className={`rounded-md border px-3 py-1.5 text-sm ${tab==='edit'?'bg-[--brand] text-white':'bg-white hover:bg-gray-50'}`} onClick={()=>setTab('edit')}>Edit</button>
        </div>

        {tab === 'details' && (
          <div className="rounded-xl border p-3 text-sm text-gray-700">
            <div><span className="text-gray-500">Stage:</span> {client.stage || '—'}</div>
            <div><span className="text-gray-500">Assigned:</span> {client.assigned_to || '—'}</div>
            <div><span className="text-gray-500">Email:</span> {client.email || '—'}</div>
            <div><span className="text-gray-500">Phone:</span> {client.phone || '—'}</div>
          </div>
        )}

        {tab === 'tasks' && (
          <div className="rounded-xl border p-3">
            <div className="mb-2 text-sm font-semibold">Tasks for this client</div>
            <div className="divide-y">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 text-sm hover:bg-gray-50" onDoubleClick={()=>setOpenTaskId(t.id)}>
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-gray-600">
                      {t.assigned_to ? `Assigned: ${t.assigned_to}` : 'Unassigned'}
                      {t.due_date ? ` • Due: ${t.due_date}` : ''}
                      {t.status ? ` • ${t.status}` : ''}
                    </div>
                  </div>
                  <button type="button" onClick={()=>setOpenTaskId(t.id)} className="rounded-md border px-2 py-1 hover:bg-gray-50">Open</button>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-600">No tasks for this client.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-3">
            <div className="rounded-xl border p-3">
              <div className="mb-2 text-sm font-medium">Add note</div>
              <textarea className="h-24 w-full rounded-md border p-2" value={newNote} onChange={(e)=>setNewNote(e.target.value)} placeholder="Type a note… (timestamp & author auto-added)" />
              <div className="mt-2 text-right">
                <button onClick={addNote} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white">Add note</button>
              </div>
            </div>

            {loadingNotes && <div className="text-sm text-gray-500">Loading notes…</div>}
            {!loadingNotes && notes.length === 0 && (
              <div className="rounded-xl border bg-gray-50 p-3 text-center text-sm text-gray-600">No notes yet.</div>
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
        )}

        {tab === 'edit' && (
          <div className="rounded-xl border p-3">
            <ClientForm client={client} onClose={async (saved) => { if (saved) { await onSaved(); } }} />
          </div>
        )}
      </div>

      {/* Inline Task modal for double-click */}
      {openTaskId && (
        <TaskEditor
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onSaved={async () => { setOpenTaskId(null); if (tab==='tasks') await loadTasks(); }}
          allClients={[]}
        />
      )}
    </div>
  );
}
