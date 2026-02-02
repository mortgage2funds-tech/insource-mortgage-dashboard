'use client';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { createClient } from '@/lib/supabase';

import ClientActionsMenu from '@/components/ClientActionsMenu';
import ClientModal from '@/components/ClientModal';
import { ClientForm } from '@/components/ClientForm';
import TaskEditorModal from '@/components/TaskEditorModal';
import DaysInStageBadge from '@/components/DaysInStageBadge';

type ViewMode = 'list' | 'board' | 'archived';
type TaskFilter = 'Open' | 'Overdue' | 'Today' | 'Upcoming' | 'Completed' | 'All';

type ClientRow = {
  id: string;
  name?: string | null;
  stage?: string | null;
  assigned_to?: string | null;
  is_archived?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  closing_date?: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: 'open' | 'completed';
  due_date?: string | null;
  assigned_to?: string | null;
  client_id?: string | null;
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

const BRAND = '#0A5BD7';

export default function Page() {
  const supabase = createClient();
  const router = useRouter();

  const [isAuthed, setIsAuthed] = useState(false);
  const [role, setRole] = useState<'admin' | 'assistant'>('assistant');

  // Entered-at map for DaysInStageBadge
  const [enteredAtByClient, setEnteredAtByClient] = useState<Record<string, string | null>>({});

  // User chip (still on page for now; you can move into AppShell later)
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
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

  // DnD refs (board)
  const dragClientIdRef = useRef<string | null>(null);

  // -------- Auth + profile --------
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
      setUserName(prof?.full_name || (s.user.user_metadata as any)?.full_name || s.user.email || 'User');
      setUserEmail((prof as any)?.email || s.user.email || '');
    })();
  }, [supabase, router]);

  // -------- Realtime: clients --------
  useEffect(() => {
    if (!isAuthed) return;

    const clientsChannel = supabase
      .channel('realtime-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
        setClients((prev) => {
          if (payload.eventType === 'INSERT') return [payload.new as any, ...prev];
          if (payload.eventType === 'UPDATE')
            return prev.map((c) => (c.id === (payload.new as any).id ? (payload.new as any) : c));
          if (payload.eventType === 'DELETE') return prev.filter((c) => c.id !== (payload.old as any).id);
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(clientsChannel);
    };
  }, [isAuthed, supabase]);

  // -------- Realtime: tasks --------
  useEffect(() => {
    if (!isAuthed) return;

    const tasksChannel = supabase
      .channel('realtime-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        setTasks((prev) => {
          if (payload.eventType === 'INSERT') return [...prev, payload.new as any];
          if (payload.eventType === 'UPDATE')
            return prev.map((t) => (t.id === (payload.new as any).id ? (payload.new as any) : t));
          if (payload.eventType === 'DELETE') return prev.filter((t) => t.id !== (payload.old as any).id);
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
    };
  }, [isAuthed, supabase]);

  // -------- Load data --------
  async function loadClients() {
    if (view === 'archived') {
      const { data } = await supabase.from('clients').select('*').eq('is_archived', true).order('created_at', { ascending: false });
      setClients((data ?? []) as any[]);
    } else {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .or('is_archived.is.false,is_archived.is.null')
        .order('created_at', { ascending: false });
      setClients((data ?? []) as any[]);
    }

    // entered-stage-at (view)
    const { data: stageEntries, error: stageErr } = await supabase
      .from('current_stage_entry')
      .select('client_id, entered_stage_at');

    if (stageErr) {
      console.error('current_stage_entry error', stageErr);
      return;
    }

    const map: Record<string, string | null> = {};
    for (const row of stageEntries ?? []) {
      map[(row as any).client_id] = ((row as any).entered_stage_at as string) ?? null;
    }
    setEnteredAtByClient(map);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, view]);

  // Timer tick (helps “today/overdue” freshness)
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // -------- Computed --------
  const activeClients = useMemo(
    () => clients.filter((c) => c.stage !== 'Completed' && c.stage !== 'Declined' && !c.is_archived).length,
    [clients]
  );

  const sentToBanker = useMemo(() => clients.filter((c) => c.stage === 'Sent to Banker' && !c.is_archived).length, [clients]);

  const tasksOverdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date < today).length;
  }, [tasks]);

  const completedThisMonth = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return clients.filter((c) => c.stage === 'Completed' && (c.closing_date || '').startsWith(ym)).length;
  }, [clients]);

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

  const clientOptions = useMemo(() => clients.map((c) => ({ id: c.id, name: c.name || '(No name)' })), [clients]);

  // Overdue banner
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

  // -------- DnD helpers --------
  function onDragStart(e: React.DragEvent, clientId: string) {
    dragClientIdRef.current = clientId;
    e.dataTransfer.setData('text/plain', clientId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function canMove(from: string, to: string) {
    if (role === 'admin') return true;
    const a = (from || '').trim();
    const b = (to || '').trim();
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
    if ((row.stage || '') === stage) return;

    if (!canMove(row.stage || '', stage)) {
      alert('Assistants cannot move between Structuring ↔ Ready to Send to Banker.');
      return;
    }

    const { error } = await supabase.from('clients').update({ stage }).eq('id', id);
    if (!error) {
      // history insert (keep as you had)
      await supabase.from('client_stage_history').insert({
        client_id: id,
        from_stage: row.stage,
        to_stage: stage,
        changed_at: new Date().toISOString(),
      });

      // refresh enteredAt map
      await loadClients();
    }
  }

  return (
    <AppShell title="Dashboard" subtitle="Pipeline, tasks, and client activity">
      <div className="space-y-4">
        {/* Overdue banner */}
        {showOverdueBanner && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <div>
              <span className="font-medium">Heads up:</span> You have <span className="font-semibold">{tasksOverdue}</span>{' '}
              overdue task{tasksOverdue === 1 ? '' : 's'}.
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

        {/* Top row (keep for now) */}
         <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
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

        {/* Tasks */}
        <div ref={tasksPanelRef} className="space-y-2 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Tasks</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCreateTask(true)} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
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
                  <button onClick={() => setOpenTaskId(t.id)} className="rounded-md border px-2 py-1 hover:bg-gray-50">
                    Open
                  </button>
                  {t.status === 'open' ? (
                    <button
                      onClick={async () => {
                        await supabase.from('tasks').update({ status: 'completed' }).eq('id', t.id);
                      }}
                      className="rounded-md border px-2 py-1 hover:bg-gray-50"
                    >
                      Mark Completed
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await supabase.from('tasks').update({ status: 'open' }).eq('id', t.id);
                      }}
                      className="rounded-md border px-2 py-1 hover:bg-gray-50"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredTasks.length === 0 && <div className="py-6 text-center text-xs text-gray-600">No tasks</div>}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPI title="Active Clients" value={activeClients} />
          <KPI title="Sent to Banker" value={sentToBanker} />
          <KPI title="Tasks Overdue" value={tasksOverdue} />
          <KPI title="Completed (This Month)" value={completedThisMonth} />
        </div>

        {/* Stage Summary */}
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

        {/* Controls panel */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <TabButton active={view === 'list'} onClick={() => (setView('list'), window.scrollTo({ top: 0, behavior: 'smooth' }))}>
              List
            </TabButton>
            <TabButton active={view === 'board'} onClick={() => (setView('board'), window.scrollTo({ top: 0, behavior: 'smooth' }))}>
              Board
            </TabButton>
            <TabButton
              active={view === 'archived'}
              onClick={() => (setView('archived'), window.scrollTo({ top: 0, behavior: 'smooth' }))}
            >
              Archived
            </TabButton>
          </div>
        </div>

        {/* Views panel */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          {view === 'list' && (
            <ListView
              clients={clients}
              tasksByClient={tasksByClient}
              setSelectedClient={setSelectedClient}
              enteredAtByClient={enteredAtByClient}
            />
          )}

          {view === 'board' && (
            <BoardView
              clients={clients}
              onDragStart={onDragStart}
              onDropTo={onDropTo}
              tasksByClient={tasksByClient}
              onOpenClient={(c) => setSelectedClient(c)}
              enteredAtByClient={enteredAtByClient}
            />
          )}

          {view === 'archived' && (
            <ArchivedView clients={clients} tasksByClient={tasksByClient} setSelectedClient={setSelectedClient} />
          )}
        </div>

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
                <button onClick={() => setShowCreateClient(false)} className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50">
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
      </div>
    </AppShell>
  );
}

/* ---------------------- Small components ---------------------- */

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
      className={`rounded-md border px-3 py-2 text-sm ${active ? 'bg-[--brand] text-white' : 'bg-white hover:bg-gray-50'}`}
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
  enteredAtByClient,
}: {
  clients: ClientRow[];
  tasksByClient: Record<string, { open: number; total: number }>;
  setSelectedClient: (c: ClientRow) => void;
  enteredAtByClient: Record<string, string | null>;
}) {
  const activeClients = clients.filter((c) => !c.is_archived);

  return (
    <div className="space-y-2">
      {activeClients.map((c) => (
        <div key={c.id} className="rounded-xl border bg-white p-3 text-sm hover:bg-gray-50">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{c.name || '(No name)'}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span>Stage: {c.stage || '—'}</span>
                <DaysInStageBadge
                  enteredAt={enteredAtByClient?.[c.id] ?? null}
                  fallbackDate={c.updated_at ?? c.created_at ?? null}
                  stageLabel={c.stage || 'Stage'}
                />
                <span>• Assigned: {c.assigned_to || '—'}</span>
                <span>• Open tasks: {tasksByClient?.[c.id]?.open ?? 0}</span>
              </div>
            </div>
            <ClientActionsMenu clientId={c.id} isArchived={false} />
          </div>

          <div className="mt-2">
            <button onClick={() => setSelectedClient(c)} className="rounded-md border px-3 py-1 text-xs hover:bg-white">
              Open client
            </button>
          </div>
        </div>
      ))}

      {activeClients.length === 0 && (
        <div className="rounded-xl border border-dashed bg-gray-50 p-4 text-center text-xs text-gray-500">No clients.</div>
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
  enteredAtByClient,
}: {
  clients: ClientRow[];
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDropTo: (stage: string) => void;
  tasksByClient: Record<string, { open: number; total: number }>;
  onOpenClient: (c: ClientRow) => void;
  enteredAtByClient: Record<string, string | null>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {PIPELINE_STAGES.map((stage) => {
        const stageClients = clients.filter((c) => c.stage === stage && !c.is_archived);

        return (
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
              <div className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{stageClients.length}</div>
            </div>

            <div className="space-y-2">
              {stageClients.map((c) => (
                <div
                  key={c.id}
                  className="cursor-pointer rounded-xl border bg-white p-2 text-sm shadow-sm hover:bg-gray-50"
                  draggable
                  onDragStart={(e) => onDragStart(e, c.id)}
                  onClick={() => onOpenClient(c)}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-medium truncate">{c.name || '(No name)'}</div>
                    <div className="flex items-center gap-2">
                      <DaysInStageBadge
                        enteredAt={enteredAtByClient?.[c.id] ?? null}
                        fallbackDate={c.updated_at ?? c.created_at ?? null}
                        stageLabel={stage}
                      />
                      <div className="text-xs text-gray-500">{tasksByClient?.[c.id]?.open ?? 0} open</div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600">Assigned: {c.assigned_to || '—'}</div>

                  <div className="mt-2 flex justify-end">
                    <ClientActionsMenu clientId={c.id} isArchived={false} />
                  </div>
                </div>
              ))}

              {stageClients.length === 0 && (
                <div className="rounded-xl border border-dashed bg-gray-50 p-3 text-center text-xs text-gray-500">Empty</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArchivedView({
  clients,
  tasksByClient,
  setSelectedClient,
}: {
  clients: ClientRow[];
  tasksByClient: Record<string, { open: number; total: number }>;
  setSelectedClient: (c: ClientRow) => void;
}) {
  const archived = clients.filter((c) => c.is_archived);

  return (
    <div className="space-y-2">
      {archived.map((c) => (
        <div
          key={c.id}
          className="cursor-pointer rounded-xl border bg-white p-3 text-sm shadow-sm hover:bg-gray-50"
          onClick={() => setSelectedClient(c)}
        >
          <div className="mb-1 flex items-center justify-between">
            <div className="font-medium">{c.name || '(No name)'} </div>
            <div className="text-xs text-gray-500">{tasksByClient?.[c.id]?.open ?? 0} open</div>
          </div>
          <div className="text-xs text-gray-600">
            Stage: {c.stage || '—'} • Assigned: {c.assigned_to || '—'}
          </div>
        </div>
      ))}

      {archived.length === 0 && (
        <div className="rounded-xl border border-dashed bg-gray-50 p-4 text-center text-xs text-gray-500">No archived clients.</div>
      )}
    </div>
  );
}

