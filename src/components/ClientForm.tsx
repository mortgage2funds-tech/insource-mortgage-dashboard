'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export type ClientRow = {
  id?: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  created_email: string | null;
  file_type: 'Residential' | 'Commercial' | null;
  stage:
    | 'Lead'
    | 'Checklist Sent'
    | 'Docs Received'
    | 'Structuring Phase'
    | 'Ready to Send to Banker'
    | 'Sent to Banker'
    | 'More Info'
    | 'Approved'
    | 'Declined'
    | 'Completed'
    | null;
  assigned_to: 'Rajanpreet' | 'Champa' | null;
  banker_name: string | null;
  banker_email: string | null;
  bank: string | null;
  lender: string | null;
  next_follow_up: string | null;
  last_contact: string | null;
  notes_file_link: string | null;
  retainer_received: boolean | null;
  retainer_amount: number | null;
  subject_removal_date: string | null;
  closing_date: string | null;
};

function nullIfEmpty<T extends string | null>(v: T): T | null {
  return (v === '' || v === null) ? null : v;
}

export function ClientForm({
  client,
  onClose,
}: {
  client: ClientRow | null;
  onClose: (saved: boolean) => void;
}) {
  const supabase = createClient();
  const isEdit = !!client?.id;

  const [form, setForm] = useState<ClientRow>(
    client ?? {
      name: '',
      phone: '',
      email: '',
      created_email: '',
      file_type: 'Residential',
      stage: 'Lead',
      assigned_to: 'Champa',
      banker_name: '',
      banker_email: '',
      bank: '',
      lender: '',
      next_follow_up: '',
      last_contact: '',
      notes_file_link: '',
      retainer_received: null,
      retainer_amount: null,
      subject_removal_date: '',
      closing_date: '',
    }
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) setForm(client);
  }, [client]);

  function set<K extends keyof ClientRow>(key: K, val: ClientRow[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save() {
    try {
      setSaving(true);

      const payload = {
        name: nullIfEmpty(form.name),
        phone: nullIfEmpty(form.phone),
        email: nullIfEmpty(form.email),
        created_email: nullIfEmpty(form.created_email),
        file_type: form.file_type ?? null,
        stage: form.stage ?? null,
        assigned_to: form.assigned_to ?? null,
        banker_name: nullIfEmpty(form.banker_name),
        banker_email: nullIfEmpty(form.banker_email),
        bank: nullIfEmpty(form.bank),
        lender: nullIfEmpty(form.lender),
        next_follow_up: nullIfEmpty(form.next_follow_up),
        last_contact: nullIfEmpty(form.last_contact),
        notes_file_link: nullIfEmpty(form.notes_file_link),
        retainer_received: form.retainer_received,
        retainer_amount: form.retainer_amount ?? null,
        subject_removal_date: nullIfEmpty(form.subject_removal_date),
        closing_date: nullIfEmpty(form.closing_date),
      };

      if (isEdit && client?.id) {
        const { error } = await supabase.from('clients').update(payload).eq('id', client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert(payload);
        if (error) throw error;
      }
      onClose(true);
    } catch (e: any) {
      alert(e?.message ?? 'Could not save client.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(); }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <div className="text-xs text-gray-500">Name</div>
          <input className="w-full rounded-md border px-3 py-2" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Phone</div>
          <input className="w-full rounded-md border px-3 py-2" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Email</div>
          <input className="w-full rounded-md border px-3 py-2" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Created Email (bank comms)</div>
          <input className="w-full rounded-md border px-3 py-2" value={form.created_email ?? ''} onChange={(e) => set('created_email', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">File Type</div>
          <select className="w-full rounded-md border px-3 py-2" value={form.file_type ?? 'Residential'} onChange={(e) => set('file_type', e.target.value as any)}>
            <option>Residential</option>
            <option>Commercial</option>
          </select>
        </div>
        <div>
          <div className="text-xs text-gray-500">Stage</div>
          <select className="w-full rounded-md border px-3 py-2" value={form.stage ?? 'Lead'} onChange={(e) => set('stage', e.target.value as any)}>
            {['Lead','Checklist Sent','Docs Received','Structuring Phase','Ready to Send to Banker','Sent to Banker','More Info','Approved','Declined','Completed'].map(s=>(<option key={s}>{s}</option>))}
          </select>
        </div>
        <div>
          <div className="text-xs text-gray-500">Assigned To</div>
          <select className="w-full rounded-md border px-3 py-2" value={form.assigned_to ?? 'Champa'} onChange={(e) => set('assigned_to', e.target.value as any)}>
            <option>Rajanpreet</option>
            <option>Champa</option>
          </select>
        </div>
        <div>
          <div className="text-xs text-gray-500">Bank</div>
          <input className="w-full rounded-md border px-3 py-2" value={form.bank ?? ''} onChange={(e) => set('bank', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Banker Name</div>
          <input className="w-full rounded-md border px-3 py-2" value={form.banker_name ?? ''} onChange={(e) => set('banker_name', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Banker Email</div>
          <input className="w-full rounded-md border px-3 py-2" value={form.banker_email ?? ''} onChange={(e) => set('banker_email', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Lender</div>
          <input className="w-full rounded-md border px-3 py-2" value={form.lender ?? ''} onChange={(e) => set('lender', e.target.value)} />
        </div>

        <div>
          <div className="text-xs text-gray-500">Next Follow-up</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={form.next_follow_up ?? ''} onChange={(e) => set('next_follow_up', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Last Contact</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={form.last_contact ?? ''} onChange={(e) => set('last_contact', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Subject Removal Date</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={form.subject_removal_date ?? ''} onChange={(e) => set('subject_removal_date', e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Closing Date</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={form.closing_date ?? ''} onChange={(e) => set('closing_date', e.target.value)} />
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-gray-500">OneDrive Notes File Link (optional)</div>
          <input className="w-full rounded-md border px-3 py-2" value={form.notes_file_link ?? ''} onChange={(e) => set('notes_file_link', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={()=>onClose(false)} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create client'}
        </button>
      </div>
    </form>
  );
}
