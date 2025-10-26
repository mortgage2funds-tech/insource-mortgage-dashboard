'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Props:
 * - mode: 'add' | 'edit' (we use this to reset form correctly)
 * - client: when provided in edit mode, prefills the form
 * - onClose, onSaved: callbacks after actions
 */
export function ClientForm({
  mode = 'add',
  client,
  onClose,
  onSaved,
}: {
  mode?: 'add' | 'edit';
  client?: ClientRow | null;
  onClose?: () => void;
  onSaved?: () => void;
}) {
  // ----- 1) local state for fields -----
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [file_type, setFileType] = useState<string>('Residential');

  // 🔹 NEW: final list of stages (split Decision into three)
  const STAGES = useMemo(
    () => [
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
    ],
    []
  );

  const [stage, setStage] = useState<string>('Lead');
  const [assigned_to, setAssignedTo] = useState<string>('');
  const [banker_name, setBankerName] = useState<string>('');
  const [banker_email, setBankerEmail] = useState<string>('');
  const [bank, setBank] = useState<string>('');
  const [lender, setLender] = useState<string>('');
  const [next_follow_up, setNextFollowUp] = useState<string>('');     // yyyy-mm-dd
  const [last_contact, setLastContact] = useState<string>('');         // yyyy-mm-dd
  const [notes, setNotes] = useState<string>('');
  const [retainer_received, setRetainerReceived] = useState<boolean>(false);
  const [retainer_amount, setRetainerAmount] = useState<string>('');   // keep as string in UI
  const [subject_removal_date, setSubjectRemovalDate] = useState<string>(''); // yyyy-mm-dd
  const [closing_date, setClosingDate] = useState<string>('');         // yyyy-mm-dd
  const [notes_file_link, setNotesFileLink] = useState<string>('');

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = mode === 'edit' && !!client?.id;

  // ----- 2) Reset or prefill whenever mode or client changes -----
  useEffect(() => {
    if (mode === 'edit' && client) {
      setName(client.name || '');
      setPhone(client.phone || '');
      setEmail(client.email || '');
      setFileType(client.file_type || 'Residential');
      // If there are legacy stages like "Decision (…)", keep them visible; otherwise use default.
      setStage(client.stage || 'Lead');
      setAssignedTo(client.assigned_to || '');
      setBankerName(client.banker_name || '');
      setBankerEmail(client.banker_email || '');
      setBank(client.bank || '');
      setLender(client.lender || '');
      setNextFollowUp(client.next_follow_up || '');
      setLastContact(client.last_contact || '');
      setNotes(client.notes || '');
      setRetainerReceived(!!client.retainer_received);
      setRetainerAmount(
        client.retainer_amount !== null && client.retainer_amount !== undefined
          ? String(client.retainer_amount)
          : ''
      );
      setSubjectRemovalDate(client.subject_removal_date || '');
      setClosingDate(client.closing_date || '');
      setNotesFileLink(client.notes_file_link || '');
    } else {
      // Fresh form for Add mode
      setName('');
      setPhone('');
      setEmail('');
      setFileType('Residential');
      setStage('Lead');
      setAssignedTo('');
      setBankerName('');
      setBankerEmail('');
      setBank('');
      setLender('');
      setNextFollowUp('');
      setLastContact('');
      setNotes('');
      setRetainerReceived(false);
      setRetainerAmount('');
      setSubjectRemovalDate('');
      setClosingDate('');
      setNotesFileLink('');
    }
  }, [mode, client?.id]); // 👈 key dependency = client id (and mode)

  // ----- 3) handle save (insert or update) -----
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const amountNumber =
      retainer_amount.trim() === '' ? null : Number(retainer_amount.replace(/,/g, ''));

    const row = {
      name: emptyToNull(name),
      phone: emptyToNull(phone),
      email: emptyToNull(email),
      file_type: emptyToNull(file_type),
      stage: emptyToNull(stage),
      assigned_to: emptyToNull(assigned_to),
      banker_name: emptyToNull(banker_name),
      banker_email: emptyToNull(banker_email),
      bank: emptyToNull(bank),
      lender: emptyToNull(lender),
      next_follow_up: emptyToNull(next_follow_up),
      last_contact: emptyToNull(last_contact),
      notes: emptyToNull(notes),
      retainer_received: !!retainer_received,
      retainer_amount: amountNumber,
      subject_removal_date: emptyToNull(subject_removal_date),
      closing_date: emptyToNull(closing_date),
      notes_file_link: emptyToNull(notes_file_link),
    } as Partial<ClientRow>;

    try {
      if (isEditing && client?.id) {
        const { error: updError } = await supabase.from('clients').update(row).eq('id', client.id);
        if (updError) throw updError;
      } else {
        const { error: insError } = await supabase.from('clients').insert(row);
        if (insError) throw insError;
      }

      // notify the page to refresh
      window.dispatchEvent(new CustomEvent('client:saved'));
      onSaved?.();
      onClose?.();
    } catch (err: any) {
      console.error('Save client error:', err);
      setError(err?.message || 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  }

  // ----- 4) UI -----
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TextInput label="Name" value={name} onChange={setName} required />
        <TextInput label="Phone" value={phone} onChange={setPhone} />
        <TextInput label="Email" value={email} onChange={setEmail} type="email" />
        <SelectInput
          label="File Type"
          value={file_type}
          onChange={setFileType}
          options={['Residential', 'Commercial']}
        />
        <SelectInput label="Stage" value={stage} onChange={setStage} options={STAGES} />
        <TextInput label="Assigned To" value={assigned_to} onChange={setAssignedTo} />

        <TextInput label="Banker Name" value={banker_name} onChange={setBankerName} />
        <TextInput label="Banker Email" value={banker_email} onChange={setBankerEmail} type="email" />
        <TextInput label="Bank" value={bank} onChange={setBank} />
        <TextInput label="Lender" value={lender} onChange={setLender} />

        <DateInput label="Next Follow Up" value={next_follow_up} onChange={setNextFollowUp} />
        <DateInput label="Last Contact" value={last_contact} onChange={setLastContact} />

        <CheckboxInput
          label="Retainer Received"
          checked={retainer_received}
          onChange={setRetainerReceived}
        />
        <TextInput
          label="Retainer Amount"
          value={retainer_amount}
          onChange={setRetainerAmount}
          type="text"
          placeholder="e.g. 1500"
        />

        <DateInput
          label="Subject Removal Date"
          value={subject_removal_date}
          onChange={setSubjectRemovalDate}
        />
        <DateInput label="Closing Date" value={closing_date} onChange={setClosingDate} />

        <TextInput
          label="OneDrive Notes Link"
          value={notes_file_link}
          onChange={setNotesFileLink}
          placeholder="Paste a OneDrive or SharePoint link"
        />
      </div>

      <div>
        <Label>Notes</Label>
        <textarea
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any extra notes go here…"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {saving ? (isEditing ? 'Saving changes…' : 'Adding…') : isEditing ? 'Save changes' : 'Add client'}
        </button>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </form>
  );
}

/* ---------------- helpers + small inputs ---------------- */

export type ClientRow = {
  id: string;
  created_at: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  file_type: string | null;
  stage: string | null;
  assigned_to: string | null;
  banker_name: string | null;
  banker_email: string | null;
  bank: string | null;
  lender: string | null;
  next_follow_up: string | null;
  last_contact: string | null;
  notes: string | null;
  retainer_received: boolean | null;
  retainer_amount: number | null;
  subject_removal_date: string | null;
  closing_date: string | null;
  notes_file_link: string | null;
};

function emptyToNull<T extends string | null | undefined>(v: T): T | null {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-medium text-gray-600">{children}</div>;
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>{label}{required ? ' *' : ''}</Label>
      <input
        type={type}
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="date"
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CheckboxInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 mt-6">
      <input
        id={label}
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={label} className="text-sm">{label}</label>
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="w-full rounded-md border px-3 py-2 text-sm bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
