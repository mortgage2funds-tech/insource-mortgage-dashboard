'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import ClientActionsMenu from '@/components/ClientActionsMenu';
import ClientModal from '@/components/ClientModal';
import { ClientForm } from '@/components/ClientForm';

type ClientRow = any;
type TaskRow = any;
type ViewMode = 'list' | 'board' | 'archived';
type TaskFilter = 'Open' | 'Overdue' | 'Today' | 'Upcoming' | 'Completed' | 'All';

const PIPELINE_STAGES = [
  'Lead','Checklist Sent','Docs Received','Structuring Phase','Ready to Send to Banker',
  'Sent to Banker','More Info','Appended','Declined','Completed',
];

const BRAND = '#0A5BD7';

export default function Page() {
  const supabase = createClient();

  const [isAuthed, setIsAuthed] = useState(false);
  const [role, setRole] = useState<'admin' | 'assistant'>('assistant');

  const [view, setView] = useState<ViewMode>('list');

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // NEW: separate "create" modal (so we don't open ClientModal without an id)
  const [showCreate, setShowCreate] = useState(false);

  const [taskFilter, setTaskFilter] = useState<TaskFilter>('Open');
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data?.session;
      if (!s) { setIsAuthed(false); window.location.href = '/login'; return; }
      setIsAuthed(true);
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', s.user.id).maybeSingle();
      setRole(prof?.role === 'admin' ? 'admin' : 'assistant');
    })();
  }, [supabase]);

  async function loadClients() {
    const filterArchived = view === 'archived';
    const { data } = await supabase.from('clients').select('*').eq('is_archived', filterArchived ? true : false).order('created_at', { ascending: false });
    setClients((data ?? []) as any[]);
  }
  async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
    setTasks((data ?? []) as any[]);
  }
  useEffect(() => {
    if (!isAuthed) return;
    (async () => { await Promise.all([loadClients(), loadTasks()]); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, view]);

  // KPIs
  const activeClients = useMemo(() => clients.filter((c) => c.stage !== 'Completed' && c.stage !== 'Declined').length, [clients]);
  const sentToBanker = useMemo(() => clients.filter((c) => c.stage === 'Sent to Banker').length, [clients]);
  const tasksOverdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date < today).length;
  }, [tasks]);
  const completedThisMonth = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return clients.filter((c) => c.stage === 'Completed' && (c.closing_date || '').startsWith(ym)).length;
  }, [clients]);

  // Task filter
  const filteredTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    switch (taskFilter) {
      case 'Open': return tasks.filter((t) => t.status === 'open');
      case 'Overdue': return tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date < today);
      case 'Today': return tasks.filter((t) => t.status === 'open' && t.due_date === today);
      case 'Upcoming': return tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date > today);
      case 'Completed': return tasks.filter((t) => t.status === 'completed');
      default: return tasks;
    }
  }, [tasks, taskFilter, nowTick]);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/insource-logo.png" alt="Insource" width={36} height={36} />
          <h1 className="text-xl font-semibold">Insource Mortgage Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-[--brand] px-3 py-2 text-white"
            style={{ ['--brand' as any]: BRAND }}
          >
            + Add Client
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}
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

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <TabButton active={view === 'list'} onClick={() => setView('list')}>List</TabButton>
        <TabButton active={view === 'board'} onClick={() => setView('board')}>Board</TabButton>
        <TabButton active={view === 'archived'} onClick={() => setView('archived')}>Archived</TabButton>
      </div>

      {/* Views */}
      {view === 'list' && (
        <div className="space-y-2 rounded-2xl border bg-white p-3">
          {clients.map((c) => (
            <div key={c.id} className="rounded-xl border p-3 hover:bg-gray-50">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{c.name || '(No name)'}</div>
                  <div className="text-xs text-gray-600">Stage: {c.stage || '—'} • Assigned: {c.assigned_to || '—'}</div>
                </div>
                <ClientActionsMenu clientId={c.id} isArchived={view === 'archived'} />
              </div>
              <div className="mt-2">
                <button onClick={() => setSelectedClient(c)} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
                  Open
                </button>
              </div>
            </div>
          ))}
          {clients.length === 0 && (
            <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-600">
              {view === 'archived' ? 'No archived clients' : 'No active clients'}
            </div>
          )}
        </div>
      )}

      {view === 'board' && (
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
                {clients.filter((c) => c.stage === stage).map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border p-3 hover:bg-gray-50"
                    onDoubleClick={() => setSelectedClient(c)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{c.name || '(No name)'}</div>
                        <div className="text-xs text-gray-600">Assigned: {c.assigned_to || '—'}</div>
                      </div>
                      <ClientActionsMenu clientId={c.id} isArchived={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'archived' && (
        <div className="space-y-2 rounded-2xl border bg-white p-3">
          {clients.map((c) => (
            <div key={c.id} className="rounded-xl border p-3 hover:bg-gray-50">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{c.name || '(No name)'}</div>
                  <div className="text-xs text-gray-600">Stage: {c.stage || '—'} • Assigned: {c.assigned_to || '—'}</div>
                </div>
                <ClientActionsMenu clientId={c.id} isArchived={true} />
              </div>
              <div className="mt-2">
                <button onClick={() => setSelectedClient(c)} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
                  Open
                </button>
              </div>
            </div>
          ))}
          {clients.length === 0 && (
            <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-600">No archived clients</div>
          )}
        </div>
      )}

      {/* Tasks Panel */}
      <div className="space-y-2 rounded-2xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Tasks</div>
          <div className="flex items-center gap-2">
            <select className="rounded-md border px-2 py-1 text-sm" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value as TaskFilter)}>
              <option>Open</option><option>Overdue</option><option>Today</option><option>Upcoming</option><option>Completed</option><option>All</option>
            </select>
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
                <button onClick={() => setOpenTaskId(t.id)} className="rounded-md border px-2 py-1 hover:bg-gray-50">Open</button>
                {t.status === 'open' ? (
                  <button onClick={async () => { await supabase.from('tasks').update({ status: 'completed' }).eq('id', t.id); await loadTasks(); }} className="rounded-md border px-2 py-1 hover:bg-gray-50">Mark Completed</button>
                ) : (
                  <button onClick={async () => { await supabase.from('tasks').update({ status: 'open' }).eq('id', t.id); await loadTasks(); }} className="rounded-md border px-2 py-1 hover:bg-gray-50">Reopen</button>
                )}
              </div>
            </div>
          ))}
          {filteredTasks.length === 0 && <div className="py-6 text-center text-xs text-gray-600">No tasks</div>}
        </div>
      </div>

      {/* Modals */}
      {selectedClient && (
        <ClientModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onSaved={async () => { setSelectedClient(null); await loadClients(); }}
        />
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Add Client</h3>
              <button onClick={() => setShowCreate(false)} className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50">Close</button>
            </div>
            <ClientForm client={null} onClose={async (saved) => { setShowCreate(false); if (saved) await loadClients(); }} />
          </div>
        </div>
      )}

      {openTaskId && (
        // Using a lightweight inline modal to view/update task without leaving page
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <TaskQuickView taskId={openTaskId} onClose={() => setOpenTaskId(null)} onSaved={async () => { await loadTasks(); }} />
        </div>
      )}
    </main>
  );
}

function KPI({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-gray-600">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick?: () => void; }) {
  return (
    <button onClick={onClick} className={`rounded-md border px-3 py-2 text-sm ${active ? 'bg-[--brand] text-white' : 'bg-white hover:bg-gray-50'}`} style={{ ['--brand' as any]: BRAND }}>
      {children}
    </button>
  );
}

// Small inline task viewer (avoids extra import)
function TaskQuickView({ taskId, onClose, onSaved }: { taskId: string; onClose: () => void; onSaved: () => void; }) {
  const supabase = createClient() as any;
  const [task, setTask] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => { const { data } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle(); setTask(data); })(); }, [supabase, taskId]);

  async function toggle() {
    if (!task) return;
    setSaving(true);
    const next = task.status === 'open' ? 'completed' : 'open';
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', task.id);
    if (!error) { const { data } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle(); setTask(data); onSaved(); }
    setSaving(false);
  }

  if (!task) return (<div className="rounded-2xl bg-white p-4">Loading…</div>);

  return (
    <div className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-lg font-semibold">Task</div>
        <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">Close</button>
      </div>
      <div className="space-y-2">
        <div><div className="text-xs text-gray-500">Title</div><div className="text-sm">{task.title ?? '—'}</div></div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500 text-xs">Assigned</span><div>{task.assigned_to ?? '—'}</div></div>
          <div><span className="text-gray-500 text-xs">Due</span><div>{task.due_date ?? '—'}</div></div>
          <div><span className="text-gray-500 text-xs">Status</span><div><span className="rounded-full border px-2 py-0.5">{task.status}</span></div></div>
          <div><span className="text-gray-500 text-xs">Client ID</span><div>{task.client_id ?? '—'}</div></div>
        </div>
        <div><div className="text-xs text-gray-500">Notes</div><div className="whitespace-pre-wrap rounded-xl border bg-gray-50 p-3 text-sm">{task.notes ?? '—'}</div></div>
      </div>
      <div className="mt-4">
        <button onClick={toggle} disabled={saving} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
          {saving ? 'Working…' : (task.status === 'open' ? 'Mark completed' : 'Reopen')}
        </button>
      </div>
    </div>
  );
}
