'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

type ClientOption = { id: string; name: string };

type TaskEditorModalProps = {
  taskId?: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  allClients: ClientOption[];
};

type TaskFormState = {
  title: string;
assigned_to: string;
  notes: string;
  client_id: string;
  due_date: string; // "YYYY-MM-DD"
  status: 'open' | 'completed';
};
type TaskRow = {
  id: any;
  title: any;
  notes: any;
  client_id: any;
  due_date: any;
  status: any;
  assigned_to?: any;
};

const ASSIGNEE_EMAILS: Record<string, string> = {
  Rajanpreet: 'rajanpreet@theinsource.ca',
  Champa: 'champa@theinsource.ca',
  Assistant: 'mortgage2funds@gmail.com',
};


export default function TaskEditorModal({
  taskId,
  onClose,
  onSaved,
  allClients,
}: TaskEditorModalProps) {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<TaskFormState>({
    title: '',
    notes: '',
    client_id: '',
    due_date: '',
    status: 'open',
assigned_to: '',
  });

  // Load existing task if editing
   React.useEffect(() => {
  if (!taskId) return;

  let cancelled = false;

  const loadTask = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, notes, client_id, due_date, status, assigned_to')
      .eq('id', taskId)
      .maybeSingle();

    if (cancelled) return;

    if (error) {
      console.error('load task error', error);
      setError('Failed to load task');
      setLoading(false);
      return;
    }

    if (data) {
      const row: any = data;

      setForm((prev) => ({
        ...prev,
        title: row.title ?? '',
        notes: row.notes ?? '',
        client_id: row.client_id ?? '',
        due_date: row.due_date ? String(row.due_date).slice(0, 10) : '',
        status: (row.status as 'open' | 'completed') ?? 'open',
        assigned_to: row.assigned_to ?? '',
      }));
    }

    setLoading(false);
  };

  loadTask();

  return () => {
    cancelled = true;
  };
}, [taskId, supabase]);

  const handleChange = (field: keyof TaskFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const isNew = !taskId;

    try {
      const payload: any = {
        title: form.title || null,
        notes: form.notes || null,
        client_id: form.client_id || null,
        due_date: form.due_date || null,
        status: form.status,
assigned_to: form.assigned_to || null,
      };
console.log('ASSIGNED_TO VALUE:', payload.assigned_to);
      if (taskId) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert([payload]);
        if (error) throw error;
      }

// Fire-and-forget email for NEW tasks only
if (isNew) {
  try {
    const clientName =
      allClients.find((c) => c.id === form.client_id)?.name ?? '';

const assignedName = form.assigned_to;
const to = assignedName ? ASSIGNEE_EMAILS[assignedName] : undefined;

console.log('EMAIL: assigned_to =', assignedName, 'to =', to);

    if (to) {
      await fetch('/api/task-created', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          title: form.title,
          notes: form.notes,
          clientName,
          dueDate: form.due_date,
        }),
      });
    } else {
 console.log('EMAIL: no email mapping for assigned_to:', assignedName);
  }
  } catch (err) {
    console.error('task-created email error', err);
  }
}

      await onSaved();
      onClose();
} catch (err: any) {
  console.error('save task error', err);
  setError(err?.message || err?.error_description || 'Failed to save task');
} finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">
            {taskId ? 'Edit Task' : 'New Task'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading task…</div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!saving) handleSave();
            }}
          >
            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div>
              <div className="text-xs text-gray-500">Title</div>
              <input
                type="text"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Follow up with client"
              />
            </div>

            <div>
              <div className="text-xs text-gray-500">Related Client</div>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={form.client_id}
                onChange={(e) => handleChange('client_id', e.target.value)}
              >
                <option value="">(none)</option>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Due date</div>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    handleChange('status', e.target.value as 'open' | 'completed')
                  }
                >
                  <option value="open">Open</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
<div>
  <div className="text-xs text-gray-500">Task assigned to</div>
  <select
    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
    value={form.assigned_to}
    onChange={(e) => handleChange('assigned_to', e.target.value)}
  >
    <option value="Rajanpreet">Rajanpreet</option>
    <option value="Assistant">Assitant</option>
    <option value="Champa">Champa</option>
  </select>
</div>

            </div>

            <div>
              <div className="text-xs text-gray-500">Notes (task)</div>
              <textarea
                className="mt-1 h-24 w-full rounded-md border p-2 text-sm"
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Add any details needed for this task"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save task'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

