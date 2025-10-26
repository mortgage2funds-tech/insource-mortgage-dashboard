'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Keep a local copy of the client shape (matches your DB columns)
export type ClientFormRow = {
  id?: string;
  created_at?: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  file_type: string | null; // 'Residential' | 'Commercial'
  stage: string | null;
  assigned_to: string | null; // 'Rajanpreet' | 'Champa' | etc.
  banker_name: string | null;
  banker_email: string | null;
  bank: string | null;
  lender: string | null;
  next_follow_up: string | null; // yyyy-mm-dd
  last_contact: string | null;   // yyyy-mm-dd
  notes: string | null;
  retainer_received: boolean | null;
  retainer_amount: number | null;
  subject_removal_date: string | null; // yyyy-mm-dd
  closing_date: string | null;         // yyyy-mm-dd
  notes_file_link: string | null;      // OneDrive link
};

const PIPELINE_STAGES = [
  'Lead',
  'Checklist Sent',
  'Docs Received',
  'Structuring Phase',
  'Ready to Send to Banker',
  'Sent to Banker',
  'More Info',
  'Approved',
  'Declined',
  'Completed',
];

type Props = {
  mode?: 'add' | 'edit';
  client?: ClientFormRow | null;
  onClose?: () => void;
  onSaved?: () => void;
  /** NEW: allow page to pass current role; optional to keep backward compatible */
  role?: 'admin' | 'assistant';
};

export function ClientForm({
  mode = 'add',
  client = null,
  onClose,
  onSaved,
  role = 'assistant',
}: Props) {
  // ------- form state -------
  const [form, setForm] = useState<ClientFormRow>({
    id: client?.id,
    name: client?.name ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    file_type: client?.file_type ?? 'Residential',
    stage: client?.stage ?? 'Lead',
    assigned_to: client?.assigned_to ?? 'Rajanpreet',
    banker_name: client?.banker_name ?? '',
    banker_email: client?.banker_email ?? '',
    bank: client?.bank ?? '',
    lender: client?.lender ?? '',
    next_follow_up: client?.next_follow_up ?? '',
    last_contact: client?.last_contact ?? '',
    notes: client?.notes ?? '',
    retainer_received: client?.retainer_received ?? false,
    retainer_amount: client?.retainer_amount ?? 0,
    subject_removal_date: client?.subject_removal_date ?? '',
    closing_date: client?.closing_date ?? '',
    notes_file_link: client?.notes_file_link ?? '',
    created_at: client?.created_at ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional UI guard: if assistant, visually warn about the restricted move.
  const stageHint = useMemo(() => {
    if (role !== 'assistant') return '';
    return 'Note: Assistants cannot move directly between “Structuring Phase” and “Ready to Send to Banker” (admin only).';
  }, [role]);

  function update<K extends keyof ClientFormRow>(key: K, value: ClientFormRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ------- submit handlers -------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Build payload that matches DB
    const payload = {
      name: (form.name || '').trim() || null,
      phone: (form.phone || '').trim() || null,
      email: (form.email || '').trim() || null,
      file_type: form.file_type || null,
      stage: form.stage || null,
      assigned_to: form.assigned_to || null,
      banker_name: (form.banker_name || '').trim() || null,
      banker_email: (form.banker_email || '').trim() || null,
      bank: (form.bank || '').trim() || null,
      lender: (form.lender || '').trim() || null,
      next_follow_up: form.next_follow_up || null,
      last_contact: form.last_contact || null,
      notes: form.notes || null,
      retainer_received: !!form.retainer_received,
      retainer_amount:
        form.retainer_amount === null || form.retainer_amount === undefined
          ? null
          : Number(form.retainer_amount),
      subject_removal_date: form.subject_removal_date || null,
      closing_date: form.closing_date || null,
      notes_file_link: form.notes_file_link || null,
    };

    try {
      if (mode === 'edit' && form.id) {
        const { error: upErr } = await supabase.from('clients').update(payload).eq('id', form.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase.from('clients').insert([payload]);
        if (insErr) throw insErr;
      }

      // Let the parent know and close
      if (onSaved) onSaved();
      // also broadcast to any listeners (page is listening)
      try {
        window.dispatchEvent(new Event('client:saved'));
      } catch {}
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Save client failed:', err);
      setError(err?.message || 'Failed to save client.');
    } finally {
      setSaving(false);
    }
  }

  // ------- render -------
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-sm text-red-700 p-2">
          {error}
        </div>
      )}

      {stageHint && (
        <div className="rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-800 p-2">
          {stageHint}
        </div>
      )}

      {/* Basic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Name">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.name || ''}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.phone || ''}
            onChange={(e) => update('phone', e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.email || ''}
            onChange={(e) => update('email', e.target.value)}
          />
        </Field>
      </div>

      {/* File + Stage + Assigned */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="File Type">
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.file_type || 'Residential'}
            onChange={(e) => update('file_type', e.target.value)}
          >
            <option>Residential</option>
            <option>Commercial</option>
          </select>
        </Field>

        <Field label="Stage">
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.stage || 'Lead'}
            onChange={(e) => update('stage', e.target.value)}
          >
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assigned To">
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.assigned_to || ''}
            onChange={(e) => update('assigned_to', e.target.value)}
          >
            <option value="">—</option>
            <option value="Rajanpreet">Rajanpreet</option>
            <option value="Champa">Champa</option>
          </select>
        </Field>
      </div>

      {/* Banker / Lender */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Banker Name">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.banker_name || ''}
            onChange={(e) => update('banker_name', e.target.value)}
          />
        </Field>
        <Field label="Banker Email">
          <input
            type="email"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.banker_email || ''}
            onChange={(e) => update('banker_email', e.target.value)}
          />
        </Field>
        <Field label="Bank / Lender">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g. TD / First National"
            value={form.bank || form.lender || ''}
            onChange={(e) => {
              // keep both for compatibility
              update('bank', e.target.value);
              update('lender', e.target.value);
            }}
          />
        </Field>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Next Follow Up">
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.next_follow_up || ''}
            onChange={(e) => update('next_follow_up', e.target.value)}
          />
        </Field>
        <Field label="Last Contact">
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.last_contact || ''}
            onChange={(e) => update('last_contact', e.target.value)}
          />
        </Field>
        <Field label="Subject Removal Date">
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.subject_removal_date || ''}
            onChange={(e) => update('subject_removal_date', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Closing Date">
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.closing_date || ''}
            onChange={(e) => update('closing_date', e.target.value)}
          />
        </Field>

        <Field label="Retainer Received" inline>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={!!form.retainer_received}
            onChange={(e) => update('retainer_received', e.target.checked)}
          />
        </Field>

        <Field label="Retainer Amount">
          <input
            type="number"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.retainer_amount ?? 0}
            onChange={(e) => update('retainer_amount', Number(e.target.value))}
          />
        </Field>
      </div>

      {/* Notes + OneDrive */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Notes">
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={4}
            value={form.notes || ''}
            onChange={(e) => update('notes', e.target.value)}
          />
        </Field>
        <Field label="OneDrive Notes Link (share URL)">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="https://1drv.ms/…"
            value={form.notes_file_link || ''}
            onChange={(e) => update('notes_file_link', e.target.value)}
          />
        </Field>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          disabled={saving}
        >
          {saving ? (mode === 'edit' ? 'Saving…' : 'Creating…') : (mode === 'edit' ? 'Save changes' : 'Create client')}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  inline = false,
}: {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <label className={`text-sm block ${inline ? 'flex items-center gap-2' : ''}`}>
      <div className={`text-gray-600 ${inline ? '' : 'mb-1'}`}>{label}</div>
      {children}
    </label>
  );
}

