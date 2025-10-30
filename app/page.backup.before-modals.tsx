'use client';
import ClientActionsMenu from '@/components/ClientActionsMenu';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { toOneDriveEmbed } from '@/lib/onedriveEmbed';
import { ClientForm } from '@/components/ClientForm';

/* ---------- Types ---------- */
export type ClientRow = {
  id: string;
  created_at: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  file_type: 'Residential' | 'Commercial' | null;
  stage:
    | 'Lead'
    | 'Checklist Sent'
    | 'Docs Received'
    | 'Structuring Phase'
    | 'Ready to Send to Banker'
    | 'Sent to Banker'
    | 'More Info'
    | 'Appended'
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
  notes: string | null;
  retainer_received: boolean | null;
  retainer_amount: number | null;
  subject_removal_date: string | null;
  closing_date: string | null;
  notes_file_link: string | null;
};

type TaskRow = {
  id: string;
  created_at: string | null;
  title: string | null;
  client_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: 'open' | 'completed' | null;
  notes: string | null;
};

type ViewMode = 'list' | 'board';
type TaskFilter = 'Open' | 'Overdue' | 'Today' | 'Upcoming' | 'Completed' | 'All';

const PIPELINE_STAGES = [
  'Lead',
  'Checklist Sent',
  'Docs Received',
  'Structuring Phase',
  'Ready to Send to Banker',
  'Sent to Banker',
  'More Info',
  'Appended',
  'Declined',
  'Completed',
];

// Brand colors
const BRAND = '#0A5BD7';
const BRAND_HOVER = '#094fc0';

/* ===================== PAGE ===================== */
export default function Page() {
  const supabase = createClient();

  // 🔐 Auth + Profile
  const [isAuthed, setIsAuthed] = useState(false);
  const [role, setRole] = useState<'admin' | 'assistant'>('assistant');

  // View state
  const [view, setView] = useState<ViewMode>('list');

  // Data
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  // UI: modals/panels
  const [showAddClient, setShowAddClient] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [selected, setSelected] = useState<ClientRow | null>(null);

  // Tasks
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('Open');

  // live tick for banners
  const [nowTick, setNowTick] = useState(0);

  // KPI derived
  const activeClients = useMemo(
    () => clients.filter((c) => c.stage !== 'Completed' && c.stage !== 'Declined').length,
    [clients]
  );
  const sentToBanker = useMemo(
    () => clients.filter((c) => c.stage === 'Sent to Banker').length,
    [clients]
  );
  const tasksOverdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date < today).length;
  }, [tasks]);
  const completedThisMonth = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return clients.filter(
      (c) => c.stage === 'Completed' && (c.closing_date || '').startsWith(ym)
    ).length;
  }, [clients]);

  // Overdue banner
  const [showOverdueBanner, setShowOverdueBanner] = useState<boolean>(false);

  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* -------- Auth + Role -------- */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) {
        setIsAuthed(false);
        window.location.href = '/login';
        return;
      }
      setIsAuthed(true);
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      setRole(prof?.role === 'admin' ? 'admin' : 'assistant');
    })();
  }, [supabase]);

  /* -------- Data loaders -------- */
  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('is_archived', false) // hide archived on main dashboard
      .order('created_at', { ascending: false });
    setClients((data || []) as ClientRow[]);
  };

  const loadTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true });
    setTasks((data || []) as TaskRow[]);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadClients(), loadTasks()]);
      const today = new Date().toISOString().slice(0, 10);
      setShowOverdueBanner(
        (tasks || []).some((t) => t.status === 'open' && t.due_date && t.due_date < today)
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  /* -------- Task helpers -------- */
  async function completeTask(taskId: string) {
    const { error } = await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId);
    if (!error) await loadTasks();
  }
  async function reopenTask(taskId: string) {
    const { error } = await supabase.from('tasks').update({ status: 'open' }).eq('id', taskId);
    if (!error) await loadTasks();
  }

  /* -------- Client form helpers -------- */
  function onAddClient() {
    setEditingClient(null);
    setShowAddClient(true);
  }
  function onEditClient(c: ClientRow) {
    setEditingClient(c);
    setShowAddClient(true);
  }
  async function onFormSaved() {
    setShowAddClient(false);
    setEditingClient(null);
    await loadClients();
  }
  function onFormCancel() {
    setShowAddClient(false);
    setEditingClient(null);
  }

  /* -------- Board drag/drop -------- */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  async function onDropToStage(clientId: string, newStage: ClientRow['stage']) {
    try {
      if (
        role !== 'admin' &&
        (newStage === 'Ready to Send to Banker' || newStage === 'Structuring Phase')
      ) {
        alert('Only admin can move between Structuring Phase ↔ Ready to Send to Banker.');
        return;
      }
      const { error } = await supabase.from('clients').update({ stage: newStage }).eq('id', clientId);
      if (error) throw error;
      await loadClients();
    } catch {
      alert('Could not move card. Please try again.');
    }
  }

  // Tasks actions quick
  async function completeTaskQuick(t: TaskRow) {
    if (!t.id) return;
    await completeTask(t.id);
  }

  /* -------- Derived panels -------- */
  const filteredTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    switch (taskFilter) {
      case 'Open':
        return tasks.filter((t) => t.status === 'open');
      case 'Overdue':
        return tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date < today);
      case 'Today':
        return tasks.filter((t) => t.status === 'open' && t.due_date === today);
      case 'Upcoming':
        return tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date > today);
      case 'Completed':
        return tasks.filter((t) => t.status === 'completed');
      case 'All':
      default:
        return tasks;
    }
  }, [tasks, taskFilter, nowTick]);

  /* ===================== UI ===================== */
  return (
    <main className="mx-auto max-w-7xl p-4 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/insource-logo.png" alt="Insource" width={36} height={36} />
          <h1 className="text-xl font-semibold">Insource Mortgage Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={onAddClient}
            className="rounded-md bg-[--brand] px-3 py-2 text-white"
            style={{ ['--brand' as any]: BRAND, ['--brandH' as any]: BRAND_HOVER }}
          >
            + Add Client
          </button>
          <a href="/actions" className="rounded-md border px-3 py-2 hover:bg-gray-50">
            Actions
          </a>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="rounded-md border px-3 py-2 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI title="Active Clients" value={activeClients} />
        <KPI title="Sent to Banker" value={sentToBanker} />
        <KPI title="Tasks Overdue" value={tasksOverdue} />
        <KPI title="Completed (This Month)" value={completedThisMonth} />
      </div>

      {/* Stage Summary (bigger counts for visibility) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {PIPELINE_STAGES.map((s) => {
          const n = clients.filter((c) => c.stage === s).length;
          return (
            <div key={s} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
              <div className="text-sm">{s}</div>
              <div className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{n}</div>
            </div>
          );
        })}
      </div>

      {/* Overdue banner */}
      {showOverdueBanner && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          You have overdue tasks. Check the Tasks panel below.
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <TabButton active={view === 'list'} onClick={() => setView('list')}>List</TabButton>
        <TabButton active={view === 'board'} onClick={() => setView('board')}>Board</TabButton>
      </div>

      {/* Views */}
      {view === 'list' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Left: Clients list */}
          <div className="space-y-2 rounded-2xl border bg-white p-3 md:col-span-2">
            {clients.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                className="cursor-pointer rounded-xl border p-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.name || '(No name)'}</div>
                    <div className="text-xs text-gray-600">
                      Stage: {c.stage || '—'} • Assigned: {c.assigned_to || '—'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(c.created_at || '').toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
            {clients.length === 0 && (
              <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-600">
                No active clients
              </div>
            )}
          </div>

          {/* Right: Selected client details */}
          <div className="space-y-3 rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-500">Details</div>

            {!selected && (
              <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
                Select a client to see details.
              </div>
            )}

            {selected && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{selected.name || '(No name)'}</h2>
                  <div className="flex gap-2">
                    <ClientActionsMenu clientId={selected.id} isArchived={false} />
                    <button
                      onClick={() => onEditClient(selected)}
                      className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Stage" value={selected.stage || '—'} />
                  <Info label="Assigned" value={selected.assigned_to || '—'} />
                  <Info label="Phone" value={selected.phone || '—'} />
                  <Info label="Email" value={selected.email || '—'} />
                  <Info label="Type" value={selected.file_type || '—'} />
                  <Info label="Bank" value={selected.bank || '—'} />
                  <Info label="Lender" value={selected.lender || '—'} />
                  <Info label="Next follow-up" value={selected.next_follow_up || '—'} />
                  <Info label="Last contact" value={selected.last_contact || '—'} />
                  <Info label="Subject removal" value={selected.subject_removal_date || '—'} />
                  <Info label="Closing date" value={selected.closing_date || '—'} />
                </div>

                {/* Notes preview / OneDrive embed */}
                {selected.notes_file_link ? (
                  <div className="rounded-xl border">
                    <iframe
                      src={toOneDriveEmbed(selected.notes_file_link)}
                      className="h-64 w-full rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-600">
                    No OneDrive notes file linked.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Board View
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage} className="rounded-2xl border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">{stage}</div>
                <div className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {clients.filter((c) => c.stage === stage).length}
                </div>
              </div>

              <div className="space-y-2">
                {clients
                  .filter((c) => c.stage === stage)
                  .map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDraggingId(c.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggingId && draggingId !== c.id) {
                          onDropToStage(draggingId, stage as ClientRow['stage']);
                        }
                      }}
                      onDoubleClick={() => { setSelected(c); setView('list'); }}
                      className="rounded-xl border p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{c.name || '(No name)'}</div>
                          <div className="text-xs text-gray-600">
                            Assigned: {c.assigned_to || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tasks Panel */}
      <div className="space-y-2 rounded-2xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Tasks</div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value as TaskFilter)}
            >
              <option>Open</option>
              <option>Overdue</option>
              <option>Today</option>
              <option>Upcoming</option>
              <option>Completed</option>
              <option>All</option>
            </select>
            <a href="/tasks" className="text-sm underline">Open Tasks Page</a>
          </div>
        </div>

        <div className="divide-y">
          {filteredTasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-gray-600">
                  {t.assigned_to ? `Assigned: ${t.assigned_to}` : 'Unassigned'}
                  {t.due_date ? ` • Due: ${t.due_date}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/tasks/${t.id}`} className="rounded-md border px-2 py-1 hover:bg-gray-50">
                  Open
                </a>
                {t.status === 'open' ? (
                  <button onClick={() => completeTaskQuick(t)} className="rounded-md border px-2 py-1 hover:bg-gray-50">
                    Mark Completed
                  </button>
                ) : (
                  <button onClick={() => reopenTask(t.id!)} className="rounded-md border px-2 py-1 hover:bg-gray-50">
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
          {filteredTasks.length === 0 && (
            <div className="py-6 text-center text-xs text-gray-600">No tasks</div>
          )}
        </div>
      </div>

      {/* Add/Edit Client Modal (so "Edit" works) */}
      {showAddClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{editingClient ? 'Edit Client' : 'Add Client'}</h3>
              <button onClick={onFormCancel} className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50">
                Close
              </button>
            </div>
            <ClientForm client={editingClient} onClose={(saved)=> saved ? onFormSaved() : onFormCancel()} />
          </div>
        </div>
      )}
    </main>
  );
}

/* ---------- UI bits ---------- */
function KPI({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-gray-600">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm ${
        active ? 'bg-[--brand] text-white' : 'bg-white hover:bg-gray-50'
      }`}
      style={{ ['--brand' as any]: BRAND }}
    >
      {children}
    </button>
  );
}
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div>{value}</div>
    </div>
  );
}
