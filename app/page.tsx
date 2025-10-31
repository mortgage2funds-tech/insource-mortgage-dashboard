'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import ClientActionsMenu from '@/components/ClientActionsMenu';
import ClientModal from '@/components/ClientModal';
import { ClientForm } from '@/components/ClientForm';

type ClientRow = any;
type TaskRow = any;
type ViewMode = 'list' | 'board' | 'archived';
type TaskFilter = 'Open' | 'Overdue' | 'Today' | 'Upcoming' | 'Completed' | 'All';

const PIPELINE_STAGES = [
  'Lead','Checklist Sent','Docs Received','Structuring Phase','Ready to Send to Banker',
  'Sent to Banker','More Info','Approved','Declined','Completed',
];

const BRAND = '#0A5BD7';

export default function Page() {
  const supabase = createClient();
  const router = useRouter();

  const [isAuthed, setIsAuthed] = useState(false);
  const [role, setRole] = useState<'admin' | 'assistant'>('assistant');

  // User chip
  const [userName, setUserName] = useState<string>('User');
  const [userEmail, setUserEmail] = useState<string>('');
  const userInitials = (userName || userEmail || 'U')
    .split(' ')
    .map((s) => (s?.[0] || '').toUpperCase())
    .slice(0, 2)
    .join('');

  // UI state
  const [view, setView] = useState<ViewMode>('list');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('Open');

  // Data
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  // Modals / selections
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  // Banner + timers
  const [nowTick, setNowTick] = useState(0);
  const [showOverdueBanner, setShowOverdueBanner] = useState(false);
  const tasksPanelRef = useRef<HTMLDivElement | null>(null);

  // Session + profile
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data?.session;
      if (!s) {
        setIsAuthed(false);
        router.replace('/login');
        return;
      }
      setIsAuthed(true);

      const { data: prof } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', s.user.id)
        .maybeSingle();

      setRole(prof?.role === 'admin' ? 'admin' : 'assistant');
      setUserName(prof?.full_name || s.user.user_metadata?.full_name || s.user.email || 'User');
      setUserEmail(prof?.email || s.user.email || '');
    })();
  }, [supabase, router]);

  // Load data
  async function loadClients() {
    if (view === 'archived') {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('is_archived', true)
        .order('created_at', { ascending: false });
      setClients((data ?? []) as any[]);
    } else {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .or('is_archived.is.false,is_archived.is.null')
        .order('created_at', { ascending: false });
      setClients((data ?? []) as any[]);
    }
  }
  async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
    setTasks((data ?? []) as any[]);
  }

  useEffect(() => {
    if (!isAuthed) return;
    (async () => {
      await Promise.all([loadClients(), loadTasks()]);
    })();
  }, [isAuthed, view]); // eslint-disable-line

  // Small timer tick for Today/Overdue freshness
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // KPIs
  const activeClients = useMemo(
    () => clients.filter((c) => c.stage !== 'Completed' && c.stage !== 'Declined' && !c.is_archived).length,
    [clients]
  );
  const sentToBanker = useMemo(
    () => clients.filter((c) => c.stage === 'Sent to Banker' && !c.is_archived).length,
    [clients]
  );
  const tasksOverdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date < today).length;
  }, [tasks]);
  const completedThisMonth = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return clients.filter((c) => c.stage === 'Completed' && (c.closing_date || '').startsWith(ym)).length;
  }, [clients]);

  // Tasks per client (counts)
  const tasksByClient = useMemo(() => {
    const m: Record<string, { open: number; total: number }> = {};
    for (const t of tasks) {
      const id = t?.client_id;
      if (!id) continue;
      if (!m[id]) m[id] = { open: 0, total: 0 };
      m[id].total++;
      if (t.status === 'open') m[id].open++;
    }
    return m;
  }, [tasks]);

  // Task filter
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
      default:
        return tasks;
    }
  }, [tasks, taskFilter, nowTick]);

  const clientOptions = useMemo(
    () => clients.map((c) => ({ id: c.id, name: c.name || '(No name)' })),
    [clients]
  );

  // Overdue banner visibility
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `overdueBannerDismissed:${today}`;
    const dismissed = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    setShowOverdueBanner(!dismissed && tasksOverdue > 0);
  }, [tasksOverdue]);

  function dismissOverdueBannerForToday() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      window.localStorage.setItem(`overdueBannerDismissed:${today}`, '1');
    } catch {}
    setShowOverdueBanner(false);
  }

  function scrollToTasks() {
    if (tasksPanelRef.current) {
      tasksPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTaskFilter('Overdue');
    }
  }

  // -------- DnD helpers (Board) --------
  const dragClientIdRef = useRef<string | null>(null);

  function onDragStart(e: React.DragEvent, clientId: string) {
    dragClientIdRef.current = clientId;
    e.dataTransfer.setData('text/plain', clientId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function canMove(from: string, to: string) {
    if (role === 'admin') return true;
    // assistants cannot move between Structuring <-> Ready to Send to Banker
    const a = from.trim();
    const b = to.trim();
    if (
      (a === 'Structuring Phase' && b === 'Ready to Send to Banker') ||
      (a === 'Ready to Send to Banker' && b === 'Structuring Phase')
    ) {
      return false;
    }
    return true;
  }

  async function onDropTo(stage: string) {
    const id = dragClientIdRef.current;
    if (!id) return;
    const row = clients.find((c) => c.id === id);
    if (!row) return;
    if (row.stage === stage) return;
    if (!canMove(row.stage, stage)) {
      alert('Assistants cannot move between Structuring ↔ Ready to Send to Banker.');
      return;
    }

    const { error } = await supabase.from('clients').update({ stage }).eq('id', id);
    if (!error) {
      await supabase.from('client_stage_history').insert({
        client_id: id,
        from_stage: row.stage,
        to_stage: stage,
        changed_at: new Date().toISOString(),
      });
      await loadClients();
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      {/* Overdue banner */}
      {showOverdueBanner && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <div>
            <span className="font-medium">Heads up:</span> You have{' '}
            <span className="font-semibold">{tasksOverdue}</span> overdue task
            {tasksOverdue === 1 ? '' : 's'}.
          </div>
          <div className="flex items-center gap-2">
            <button onClick={scrollToTasks} className="rounded-md border px-3 py-1 hover:bg-white">
              View overdue
            </button>
            <button onClick={dismissOverdueBannerForToday} className="rounded-md border px-3 py-1 hover:bg-white">
              Hide for today
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/insource-logo.png"
            alt="Insource Mortgage"
            width={140}
            height={140}
            className="h-14 w-auto object-contain md:h-16"
            priority
          />
        </div>
        <div className="flex items-center gap-3">
          {/* User chip */}
          <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
              {userInitials}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-medium">{userName}</div>
              <div className="text-xs text-gray-600">{userEmail}</div>
            </div>
          </div>

          <button
            onClick={() => setShowCreateClient(true)}
            className="rounded-md bg-[--brand] px-3 py-2 text-white"
            style={{ ['--brand' as any]: BRAND }}
          >
            + Add Client
          </button>

          <a href="/analytics" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
            Analytics
          </a>

          <button
            onClick={async () => {
              const { error } = await supabase.auth.signOut();
              if (error) {
                alert(error.message);
                return;
              }
              router.replace('/login');
            }}
            className="rounded-md border px-3 py-2 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ===== Tasks on top ===== */}
      <div ref={tasksPanelRef} className="space-y-2 rounded-2xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Tasks</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateTask(true)}
              className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
            >
              + New Task
            </button>
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
          </div>
        </div>

        <div className="divide-y">
          {filteredTasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-gray-600">
                  {t.assigned_to ? `Assigned: ${t.assigned_to}` : 'Unassigned'}
                  {t.client_id ? ` • Client: ${clientOptions.find((o) => o.id === t.client_id)?.name ?? t.client_id}` : ''}
                  {t.due_date ? ` • Due: ${t.due_date}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpenTaskId(t.id)}
                  className="rounded-md border px-2 py-1 hover:bg-gray-50"
                >
                  Open
                </button>
                {t.status === 'open' ? (
                  <button
                    onClick={async () => {
                      await supabase.from('tasks').update({ status: 'completed' }).eq('id', t.id);
                      await loadTasks();
                    }}
                    className="rounded-md border px-2 py-1 hover:bg-gray-50"
                  >
                    Mark Completed
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await supabase.from('tasks').update({ status: 'open' }).eq('id', t.id);
                      await loadTasks();
                    }}
                    className="rounded-md border px-2 py-1 hover:bg-gray-50"
                  >
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI title="Active Clients" value={activeClients} />
        <KPI title="Sent to Banker" value={sentToBanker} />
        <KPI title="Tasks Overdue" value={tasksOverdue} />
        <KPI title="Completed (This Month)" value={completedThisMonth} />
      </div>

      {/* Stage Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {PIPELINE_STAGES.map((s) => {
          const n = clients.filter((c) => c.stage === s && !c.is_archived).length;
          return (
            <div key={s} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
              <div className="text-sm">{s}</div>
              <div className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{n}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <TabButton
          active={view === 'list'}
          onClick={() => {
            setView('list');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          List
        </TabButton>
        <TabButton
          active={view === 'board'}
          onClick={() => {
            setView('board');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          Board
        </TabButton>
        <TabButton
          active={view === 'archived'}
          onClick={() => {
            setView('archived');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          Archived
        </TabButton>
      </div>

      {/* Views (render ONLY the active one) */}
      {view === 'list' && (
        <ListView
          clients={clients}
          tasksByClient={tasksByClient}
          setSelectedClient={setSelectedClient}
        />
      )}

      {view === 'board' && (
        <BoardView
          clients={clients}
          onDragStart={onDragStart}
          onDropTo={onDropTo}
          tasksByClient={tasksByClient}
          onOpenClient={(c) => setSelectedClient(c)}
        />
      )}

      {view === 'archived' && (
        <ArchivedView
          clients={clients}
          tasksByClient={tasksByClient}
          setSelectedClient={setSelectedClient}
        />
      )}

      {/* Modals */}
      {selectedClient && (
        <ClientModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onSaved={async () => {
            setSelectedClient(null);
            await loadClients();
          }}
        />
      )}

      {showCreateTask && (
        <TaskEditorModal
          onClose={() => setShowCreateTask(false)}
          onSaved={async () => {
            setShowCreateTask(false);
            await loadTasks();
          }}
          allClients={clientOptions}
        />
      )}

      {openTaskId && (
        <TaskEditorModal
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onSaved={async () => {
            setOpenTaskId(null);
            await loadTasks();
          }}
          allClients={clientOptions}
        />
      )}

      {showCreateClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Add Client</h3>
              <button
                onClick={() => setShowCreateClient(false)}
                className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <ClientForm
              client={null}
              onClose={async (saved) => {
                setShowCreateClient(false);
                if (saved) await loadClients();
              }}
            />
          </div>
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
      type="button"
      aria-current={active ? 'page' : undefined}
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

/* ---------------------- Views ---------------------- */

function ListView({
  clients,
  tasksByClient,
  setSelectedClient,
}: {
  clients: any[];
  tasksByClient: any;
  setSelectedClient: (c: any) => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border bg-white p-3">
      {clients
        .filter((c) => !c.is_archived)
        .map((c) => (
          <div key={c.id} className="rounded-xl border p-3 hover:bg-gray-50">
            <div className="mb-1 flex items-center justify-between">
              <div>
                <div className="font-semibold">{c.name || '(No name)'}</div>
                <div className="text-xs text-gray-600">
                  Stage: {c.stage || '—'} • Assigned: {c.assigned_to || '—'} • Tasks:{' '}
                  {tasksByClient[c.id]?.open ?? 0} open / {tasksByClient[c.id]?.total ?? 0} total
                </div>
              </div>
              <ClientActionsMenu clientId={c.id} isArchived={false} />
            </div>
            <div className="mt-2">
              <button
                onClick={() => setSelectedClient(c)}
                className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
              >
                Open
              </button>
            </div>
          </div>
        ))}
      {clients.filter((c) => !c.is_archived).length === 0 && (
        <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-600">
          No active clients
        </div>
      )}
    </div>
  );
}

function BoardView({
  clients,
  onDragStart,
  onDropTo,
  tasksByClient,
  onOpenClient,
}: {
  clients: any[];
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDropTo: (stage: string) => void;
  tasksByClient: any;
  onOpenClient: (c: any) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {PIPELINE_STAGES.map((stage) => (
        <div
          key={stage}
          className="rounded-2xl border bg-white p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDropTo(stage);
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold">{stage}</div>
            <div className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
              {clients.filter((c) => c.stage === stage && !c.is_archived).length}
            </div>
          </div>
          <div className="space-y-2">
            {clients
              .filter((c) => c.stage === stage && !c.is_archived)
              .map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border p-3 hover:bg-gray-50"
                  draggable
                  onDragStart={(e) => onDragStart(e, c.id)}
                  onDoubleClick={() => onOpenClient(c)}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{c.name || '(No name)'}</div>
                      <div className="text-xs text-gray-600">
                        Assigned: {c.assigned_to || '—'} • Tasks:{' '}
                        {tasksByClient[c.id]?.open ?? 0} open
                      </div>
                    </div>
                    <ClientActionsMenu clientId={c.id} isArchived={false} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchivedView({
  clients,
  tasksByClient,
  setSelectedClient,
}: {
  clients: any[];
  tasksByClient: any;
  setSelectedClient: (c: any) => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border bg-white p-3">
      {clients
        .filter((c) => c.is_archived)
        .map((c) => (
          <div key={c.id} className="rounded-xl border p-3 hover:bg-gray-50">
            <div className="mb-1 flex items-center justify-between">
              <div>
                <div className="font-semibold">{c.name || '(No name)'}</div>
                <div className="text-xs text-gray-600">
                  Stage: {c.stage || '—'} • Assigned: {c.assigned_to || '—'} • Tasks:{' '}
                  {tasksByClient[c.id]?.open ?? 0} open / {tasksByClient[c.id]?.total ?? 0} total
                </div>
              </div>
              <ClientActionsMenu clientId={c.id} isArchived={true} />
            </div>
            <div className="mt-2">
              <button
                onClick={() => setSelectedClient(c)}
                className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
              >
                Open
              </button>
            </div>
          </div>
        ))}
      {clients.filter((c) => c.is_archived).length === 0 && (
        <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-600">
          No archived clients
        </div>
      )}
    </div>
  );
}

/* ------- Inline Task Editor ------- */
function TaskEditorModal({
  taskId,
  onClose,
  onSaved,
  allClients,
}: {
  taskId?: string;
  onClose: () => void;
  onSaved: () => void;
  allClients: { id: string; name: string }[];
}) {
  const supabase = createClient() as any;
  const isEdit = !!taskId;
  const [task, setTask] = useState<any>({
    title: '',
    assigned_to: 'Champa',
    due_date: '',
    status: 'open',
    notes: '',
    client_id: '',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [tNotes, setTNotes] = useState<any[]>([]);
  const [newTNote, setNewTNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(!!isEdit);

  async function loadTask() {
    if (!isEdit) return;
    setLoading(true);
    const { data } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
    setTask({ ...(data || {}), client_id: data?.client_id ?? '' });
    setLoading(false);
  }
  async function loadTaskNotes() {
    if (!isEdit) {
      setTNotes([]);
      return;
    }
    setLoadingNotes(true);
    const { data } = await supabase
      .from('task_notes')
      .select('id, task_id, body, created_at, created_by')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    const base = data ?? [];
    const ids = Array.from(new Set(base.map((n: any) => n.created_by).filter(Boolean))) as string[];
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      (profs ?? []).forEach((p: any) => {
        names[p.id] = p.full_name || p.email || 'User';
      });
    }
    setTNotes(
      base.map((n: any) => ({
        ...n,
        author_name: n.created_by ? names[n.created_by] ?? 'User' : 'User',
      }))
    );
    setLoadingNotes(false);
  }
  useEffect(() => {
    loadTask();
  }, [taskId]); // eslint-disable-line
  useEffect(() => {
    loadTaskNotes();
  }, [taskId]); // eslint-disable-line

  async function save() {
    setSaving(true);
    const payload = {
      title: task.title || null,
      assigned_to: task.assigned_to || null,
      due_date: task.due_date || null,
      status: isEdit ? task.status ?? 'open' : 'open',
      notes: task.notes || null,
      client_id: task.client_id || null,
    };
    if (isEdit) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
      if (!error) onSaved();
    } else {
      const { error } = await supabase.from('tasks').insert(payload);
      if (!error) onSaved();
    }
    setSaving(false);
  }
  async function addTaskNote() {
    if (!newTNote.trim() || !taskId) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;
    const { error } = await supabase.from('task_notes').insert({
      task_id: taskId,
      body: newTNote.trim(),
      created_by: uid,
    });
    if (!error) {
      setNewTNote('');
      await loadTaskNotes();
    } else {
      alert('Could not add note.');
    }
  }

  if (loading && isEdit) {
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
          <div className="text-lg font-semibold">{isEdit ? 'Edit Task' : 'New Task'}</div>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
            Close
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-500">Title</div>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={task.title ?? ''}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">Assigned To</div>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={task.assigned_to ?? 'Champa'}
                onChange={(e) => setTask({ ...task, assigned_to: e.target.value })}
              >
                <option>Rajanpreet</option>
                <option>Champa</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-500">Due Date</div>
              <input
                type="date"
                className="w-full rounded-md border px-3 py-2"
                value={task.due_date ?? ''}
                onChange={(e) => setTask({ ...task, due_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Related Client</div>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={task.client_id ?? ''}
              onChange={(e) => setTask({ ...task, client_id: e.target.value })}
            >
              <option value="">(none)</option>
              {allClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-gray-500">Notes (task)</div>
            <textarea
              className="h-28 w-full rounded-md border p-2"
              value={task.notes ?? ''}
              onChange={(e) => setTask({ ...task, notes: e.target.value })}
            />
          </div>

          {isEdit && (
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={task.status ?? 'open'}
                onChange={(e) => setTask({ ...task, status: e.target.value })}
              >
                <option value="open">open</option>
                <option value="completed">completed</option>
              </select>
            </div>
          )}
        </div>

        {/* Task notes timeline */}
        {isEdit && (
          <div className="mt-4 space-y-2">
            <div className="rounded-xl border p-3">
              <div className="mb-2 text-sm font-medium">Add task note</div>
              <textarea
                value={newTNote}
                onChange={(e) => setNewTNote(e.target.value)}
                className="h-20 w-full rounded-md border p-2"
                placeholder="Type a note… (timestamp & author auto-added)"
              />
              <div className="mt-2 text-right">
                <button
                  onClick={addTaskNote}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white"
                >
                  Add note
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {loadingNotes && <div className="text-sm text-gray-500">Loading notes…</div>}
              {!loadingNotes && tNotes.length === 0 && (
                <div className="rounded-xl border bg-gray-50 p-3 text-center text-sm text-gray-600">
                  No task notes yet.
                </div>
              )}
              {tNotes.map((n: any) => (
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

        <div className="mt-4 text-right">
          <button
            onClick={async () => {
              await save();
            }}
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}
