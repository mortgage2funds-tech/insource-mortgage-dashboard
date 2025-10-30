'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function TaskModal({
  taskId,
  onClose,
  onSaved,
}: {
  taskId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [task, setTask] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
    setTask(data);
  }

  useEffect(() => { load(); }, [taskId]); // eslint-disable-line

  async function toggle() {
    if (!task) return;
    setSaving(true);
    const next = task.status === 'open' ? 'completed' : 'open';
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', task.id);
    if (!error) {
      await load();
      onSaved();
    }
    setSaving(false);
  }

  if (!task) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
        <div className="rounded-2xl bg-white p-4">Loading…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Task</div>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">Close</button>
        </div>

        <div className="space-y-2">
          <div>
            <div className="text-xs text-gray-500">Title</div>
            <div className="text-sm">{task.title ?? '—'}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500 text-xs">Assigned</span><div>{task.assigned_to ?? '—'}</div></div>
            <div><span className="text-gray-500 text-xs">Due</span><div>{task.due_date ?? '—'}</div></div>
            <div><span className="text-gray-500 text-xs">Status</span><div><span className="rounded-full border px-2 py-0.5">{task.status}</span></div></div>
            <div><span className="text-gray-500 text-xs">Client ID</span><div>{task.client_id ?? '—'}</div></div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Notes</div>
            <div className="whitespace-pre-wrap rounded-xl border bg-gray-50 p-3 text-sm">{task.notes ?? '—'}</div>
          </div>
        </div>

        <div className="mt-4">
          <button onClick={toggle} disabled={saving} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
            {saving ? 'Working…' : (task.status === 'open' ? 'Mark completed' : 'Reopen')}
          </button>
        </div>
      </div>
    </div>
  );
}
