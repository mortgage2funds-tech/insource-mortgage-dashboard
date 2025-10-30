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

export type TaskRow = {
  id: string;
  created_at: string | null;
  title: string;
  client_id: string | null;
  assigned_to: string | null;
  due_date: string | null; // yyyy-mm-dd
  status: 'open' | 'completed' | 'cancelled';
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
  'Approved',
  'Declined',
  'Completed',
];

// Brand colors
const BRAND = '#0A5BD7';
const BRAND_HOVER = '#094fc0';

/* ===================== PAGE ===================== */
export default function Page() { const supabase = createClient();
  // 🔐 Auth + Profile
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [role, setRole] = useState<'admin' | 'assistant'>('assistant');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  // Data
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // UI
  const [view, setView] = useState<ViewMode>('board');
  const [activeStage, setActiveStage] = useState<string>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [taskFilter, setTaskFilter] = useState<TaskFilter>('Open');

  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [mode, setMode] = useState<'add' | 'edit'>('add');

  // New Task modal
  const [showTaskForm, setShowTaskForm] = useState<boolean>(false);

  // Realtime & freshness
  const [hasRealtime, setHasRealtime] = useState<boolean>(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState<number>(0);

  // Daily overdue banner (reactive)
  const [showOverdueBanner, setShowOverdueBanner] = useState<boolean>(false);

  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* -------- Auth + Role + User -------- */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) {
        setIsAuthed(false);
        setAuthReady(true);
        window.location.href = '/login';
        return;
      }
      setIsAuthed(true);
      setUserEmail(session.user.email || '');
      // Try to fetch name from profiles
      const { data: prof } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', session.user.id)
        .maybeSingle();

      if (prof?.role === 'admin') setRole('admin');
      else setRole('assistant');

      setUserName(prof?.full_name || session.user.user_metadata?.full_name || '');

      setAuthReady(true);
    })();
  }, []);

  /* -------- Data loaders -------- */
  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Load clients error:', error);
      setError(error.message);
      setClients([]);
    } else {
      setClients((data || []) as ClientRow[]);
    }
  };

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Load tasks error:', error);
      setTasks([]);
    } else {
      setTasks((data || []) as TaskRow[]);
    }
  };

  async function refreshAll() {
    await Promise.all([loadClients(), loadTasks()]);
    setLastUpdatedAt(new Date());
  }

  // initial + realtime
  useEffect(() => {
    if (!authReady || !isAuthed) return;

    (async () => {
      setLoading(true);
      setError(null);
      await refreshAll();
      setLoading(false);
    })();

    const onSaved = () => {
      refreshAll();
      setShowForm(false);
      setEditingClient(null);
      setMode('add');
    };
    window.addEventListener('client:saved', onSaved);

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => refreshAll())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setHasRealtime(true);
      });

    return () => {
      window.removeEventListener('client:saved', onSaved);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, isAuthed]);

  /* -------- Derived data -------- */
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of PIPELINE_STAGES) counts[s] = 0;
    for (const c of clients) {
      const s = normalizeStage(c.stage);
      counts[s] = (counts[s] || 0) + 1;
    }
    const total = clients.length;
    return { counts, total };
  }, [clients]);

  const taskBuckets = useMemo(() => {
    const today = startOfDay(new Date());
    const in7 = addDays(today, 7);
    let overdue = 0, todayCount = 0, upcoming = 0;

    for (const t of tasks) {
      if (t.status !== 'open' || !t.due_date) continue;
      const due = startOfDay(new Date(t.due_date));
      if (due < today) overdue++;
      else if (isSameDay(due, today)) todayCount++;
      else if (due > today && due <= in7) upcoming++;
    }
    return { overdue, today: todayCount, upcoming };
  }, [tasks]);

  // KPIs
  const kpis = useMemo(() => {
    const today = startOfDay(new Date());

    const activeClients = clients.filter((c) => {
      const s = normalizeStage(c.stage);
      return s !== 'Completed' && s !== 'Declined';
    }).length;

    const sentToBanker = clients.filter((c) => normalizeStage(c.stage) === 'Sent to Banker').length;

    const tasksOverdue = tasks.filter((t) => {
      if (t.status !== 'open' || !t.due_date) return false;
      const due = startOfDay(new Date(t.due_date));
      return due < today;
    }).length;

    const clientsCompletedThisMonth = clients.filter((c) => {
      if (normalizeStage(c.stage) !== 'Completed') return false;
      if (!c.closing_date) return false;
      const d = new Date(c.closing_date);
      return isSameMonth(d, today);
    }).length;

    return { activeClients, sentToBanker, tasksOverdue, clientsCompletedThisMonth };
  }, [clients, tasks]);

  // Filtered clients (list view)
  const filteredClients = useMemo(() => {
    if (activeStage === 'All') return clients;
    return clients.filter((c) => normalizeStage(c.stage) === activeStage);
  }, [clients, activeStage]);

  // Keep selection in sync (list view only)
  useEffect(() => {
    if (view !== 'list') return;
    if (filteredClients.length === 0) {
      setSelectedId(null);
      return;
    }
    const stillVisible = filteredClients.some((c) => c.id === selectedId);
    if (!stillVisible) {
      setSelectedId(filteredClients[0].id);
    }
  }, [view, activeStage, filteredClients, selectedId]);

  const selected = useMemo(
    () => filteredClients.find((c) => c.id === selectedId) || null,
    [filteredClients, selectedId]
  );

  // Map client_id -> name for tasks panel
  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clients) {
      if (c.id) map[c.id] = c.name || '(No name)';
    }
    return map;
  }, [clients]);

  /* -------- Actions -------- */
  async function onLogout() {
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout failed', e);
      alert('Logout failed. Please try again.');
    }
  }

  const onAddClient = () => {
    setMode('add');
    setEditingClient(null);
    setShowForm(true);
  };

  const onEditClient = (client?: ClientRow | null) => {
    const c = client ?? selected;
    if (!c) return;
    setMode('edit');
    setEditingClient({ ...c });
    setShowForm(true);
  };

  // DnD (Board) — block only the assistant forbidden pair
  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }
  function allowDrop(e: React.DragEvent) {
    e.preventDefault();
  }
  async function onDrop(e: React.DragEvent, newStage: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const client = clients[idx];
    const oldStage = normalizeStage(client.stage);
    if (oldStage === newStage) return;

    if (role === 'assistant') {
      const a = oldStage;
      const b = newStage;
      const blocked =
        (a === 'Structuring Phase' && b === 'Ready to Send to Banker') ||
        (a === 'Ready to Send to Banker' && b === 'Structuring Phase');
      if (blocked) {
        alert('Only Admin can move between “Structuring Phase” and “Ready to Send to Banker”.');
        return;
      }
    }

    const next = [...clients];
    next[idx] = { ...client, stage: newStage };
    setClients(next);

    const { error } = await supabase.from('clients').update({ stage: newStage }).eq('id', id);
    if (error) {
      console.error('Update stage failed:', error);
      const reverted = [...clients];
      reverted[idx] = { ...client, stage: oldStage };
      setClients(reverted);
      alert('Could not move card. Please try again.');
    }
  }

  // Tasks actions
  async function completeTask(taskId: string) {
    const { error } = await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId);
    if (error) {
      console.error('Complete task failed:', error);
      alert('Could not complete task.');
    }
  }
  async function reopenTask(taskId: string) {
    const { error } = await supabase.from('tasks').update({ status: 'open' }).eq('id', taskId);
    if (error) {
      console.error('Reopen task failed:', error);
      alert('Could not reopen task.');
    }
  }
  async function saveTaskDueDate(taskId: string, newDate: string) {
    const { error } = await supabase.from('tasks').update({ due_date: newDate || null }).eq('id', taskId);
    if (error) {
      console.error('Update due date failed:', error);
      alert('Could not update due date.');
    }
  }

  // New Task handlers
  function openTaskForm() { setShowTaskForm(true); }
  function closeTaskForm() { setShowTaskForm(false); }
  async function createTask(data: { title: string; client_id: string | null; assigned_to: string | null; due_date: string | null; notes: string | null; }) {
    const payload = {
      title: data.title.trim(),
      client_id: data.client_id || null,
      assigned_to: data.assigned_to || null,
      due_date: data.due_date || null,
      status: 'open' as const,
      notes: data.notes || null,
    };
    const { error } = await supabase.from('tasks').insert([payload]);
    if (error) {
      console.error('Create task failed:', error);
      alert('Could not create task. Please check fields.');
      return;
    }
    setShowTaskForm(false);
    await loadTasks();
  }

  /* -------- Daily overdue banner (reactive) -------- */
  const overdueOpenCount = useMemo(() => {
    const today = startOfDay(new Date());
    return tasks.filter((t) => {
      if (t.status !== 'open' || !t.due_date) return false;
      const due = startOfDay(new Date(t.due_date));
      return due < today;
    }).length;
  }, [tasks]);

  useEffect(() => {
    if (!authReady || !isAuthed) return;
    const todayKey = formatYMD(new Date());
    const emailKey = userEmail || 'anon';
    const key = `overdueSeen:${emailKey}:${todayKey}`;
    const seen = typeof window !== 'undefined' ? window.localStorage.getItem(key) : '1';
    setShowOverdueBanner(!seen && overdueOpenCount > 0);
  }, [authReady, isAuthed, overdueOpenCount, userEmail]);

  function dismissOverdueBannerForToday() {
    const todayKey = formatYMD(new Date());
    const emailKey = userEmail || 'anon';
    const key = `overdueSeen:${emailKey}:${todayKey}`;
    try { window.localStorage.setItem(key, '1'); } catch {}
    setShowOverdueBanner(false);
  }

  /* -------- Render guards -------- */
  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-gray-600">
        Checking your session…
      </div>
    );
  }
  if (!isAuthed) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-gray-600">
        Redirecting to login…
      </div>
    );
  }

  /* -------------------- RENDER -------------------- */
  const initials = getInitials(userName || userEmail);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header (compact 64px, larger readable logo) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Bigger logo without stretching (160×48 inside 64px header) */}
            <div className="relative h-12 w-40 shrink-0">
              <Image src="/insource-logo.png" alt="Insource" fill sizes="160px" className="object-contain" priority />
            </div>
            <h1 className="text-lg font-semibold leading-none">Insource Mortgage Dashboard</h1>
            <span className="ml-2 text-[11px] text-gray-600 rounded-full border px-2 py-0.5">
              {role === 'admin' ? 'Admin' : 'Assistant'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 mr-2 text-sm text-gray-600">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 font-medium">
                {initials}
              </span>
              <div className="hidden md:block">
                <div className="font-medium leading-tight">{userName || 'User'}</div>
                <div className="text-[11px] text-gray-500 leading-tight">{userEmail}</div>
              </div>
            </div>

            {/* View toggle with brand color */}
            <div className="rounded-md border overflow-hidden">
              <button
                onClick={() => setView('board')}
                className={`px-3 py-2 text-sm ${
                  view === 'board'
                    ? 'text-white'
                    : 'bg-white hover:bg-gray-50'
                }`}
                style={view === 'board' ? { backgroundColor: BRAND } : {}}
              >
                Board
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-2 text-sm ${
                  view === 'list'
                    ? 'text-white'
                    : 'bg-white hover:bg-gray-50'
                }`}
                style={view === 'list' ? { backgroundColor: BRAND } : {}}
              >
                List
              </button>
            </div>

            <button
              onClick={onAddClient}
              className="rounded-md border px-3 py-2 text-sm text-white"
              style={{ backgroundColor: BRAND }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            >
              Add client
            </button>

            <button
              onClick={onLogout}
              className="rounded-md px-3 py-2 text-sm text-white bg-gray-800 hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Daily Overdue banner */}
      {showOverdueBanner && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-3">
          <div className="rounded-xl border bg-amber-50 border-amber-200 p-3 flex items-center justify-between shadow-sm">
            <div className="text-sm">
              <span className="font-medium">{overdueOpenCount}</span> open task{overdueOpenCount === 1 ? '' : 's'} are overdue. Please review.
            </div>
            <div className="flex items-center gap-2">
              <a
                href="#tasks-panel"
                className="rounded-md border px-3 py-1 text-sm bg-white hover:bg-gray-50"
                onClick={() => setTaskFilter('Overdue')}
              >
                View Overdue
              </a>
              <button
                className="rounded-md border px-3 py-1 text-sm bg-white hover:bg-gray-50"
                onClick={dismissOverdueBannerForToday}
              >
                Dismiss for today
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl flex-1 p-4">
        {/* Top row: last updated + quick reload */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500">
            {lastUpdatedAt ? (
              <>Last updated {humanAgo(lastUpdatedAt, nowTick)} {hasRealtime ? '(realtime)' : '(auto)'} </>
            ) : (
              <>Loading…</>
            )}
          </div>
          <button
            onClick={() => refreshAll()}
            className="text-xs rounded-full border px-3 py-1 hover:bg-gray-50"
            title="Refresh now"
          >
            Refresh
          </button>
        </div>

        {/* Task Overview cards */}
        <section className="mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card color="red"     label="Overdue"       value={taskBuckets.overdue} />
            <Card color="amber"   label="Due Today"     value={taskBuckets.today} />
            <Card color="emerald" label="Upcoming (7d)" value={taskBuckets.upcoming} />
          </div>
        </section>

        {/* Stage Summary cards */}
        <section className="mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-10 gap-3">
            <SummaryCard label="Total Files" value={stageCounts.total} highlight />
            {PIPELINE_STAGES.map((stage) => (
              <SummaryCard key={stage} label={stage} value={stageCounts.counts[stage] || 0} />
            ))}
          </div>
        </section>

        {/* Summary Widgets (KPIs) */}
        <section className="mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Active Clients" value={kpis.activeClients} highlight />
            <SummaryCard label="Sent to Banker" value={kpis.sentToBanker} />
            <SummaryCard label="Tasks Overdue" value={kpis.tasksOverdue} />
            <SummaryCard label="Clients Completed (Mo.)" value={kpis.clientsCompletedThisMonth} />
          </div>
        </section>

        {/* ---- Tasks Panel ---- */}
        <section className="mb-6" id="tasks-panel">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Tasks</h2>
            <div className="flex items-center gap-2">
              {(['Open','Overdue','Today','Upcoming','Completed','All'] as TaskFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setTaskFilter(f)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    taskFilter === f ? 'text-white border-transparent' : 'bg-white hover:bg-gray-50'
                  }`}
                  style={taskFilter === f ? { backgroundColor: BRAND } : {}}
                >
                  {f}
                </button>
              ))}
              <button
                onClick={() => setShowTaskForm(true)}
                className="rounded-md border px-3 py-1.5 text-sm text-white"
                style={{ backgroundColor: BRAND }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
                title="Create a new task"
              >
                New Task
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-3 shadow-sm">
            {getFilteredTasks(tasks, taskFilter).length === 0 ? (
              <div className="text-sm text-gray-500">No tasks in this filter.</div>
            ) : (
              <ul className="space-y-2">
                {getFilteredTasks(tasks, taskFilter).map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-gray-500">
                        {t.client_id ? (clientNameById[t.client_id] || '—') : '—'} • Assigned to: {t.assigned_to || '—'}
                        {t.status !== 'open' ? ' • (completed)' : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="rounded-md border px-2 py-1 text-sm"
                        value={t.due_date || ''}
                        onChange={(e) => saveTaskDueDate(t.id, e.target.value)}
                        title="Change due date"
                      />

                      {t.status === 'open' ? (
                        <button
                          onClick={() => completeTask(t.id)}
                          className="rounded-md border px-2 py-1 text-sm bg-white hover:bg-gray-50"
                          title="Mark completed"
                        >
                          Complete
                        </button>
                      ) : (
                        <button
                          onClick={() => reopenTask(t.id)}
                          className="rounded-md border px-2 py-1 text-sm bg-white hover:bg-gray-50"
                          title="Reopen task"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Views */}
        {view === 'list' ? (
          <>
            {/* Tab bar */}
            <section className="mb-3">
              <div className="flex gap-2 overflow-auto pb-1">
                <Tab label="All" active={activeStage === 'All'} onClick={() => setActiveStage('All')} />
                {PIPELINE_STAGES.map((s) => (
                  <Tab
                    key={s}
                    label={`${s} (${stageCounts.counts[s] || 0})`}
                    active={activeStage === s}
                    onClick={() => setActiveStage(s)}
                  />
                ))}
              </div>
            </section>

            {/* Main split */}
            <main className="bg-white rounded-2xl border p-3 shadow-sm flex min-h-[60vh]">
              {/* Left list */}
              <aside className="w-80 border-r pr-3 overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Clients</div>
                  {loading && <div className="text-xs text-gray-500">Loading…</div>}
                </div>

                {error && <div className="text-xs text-red-600 mb-2">Error: {error}</div>}

                {!loading && filteredClients.length === 0 && (
                  <div className="text-sm text-gray-500">No clients in this stage.</div>
                )}
                <ul className="space-y-1">
                  {filteredClients.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full text-left rounded-xl px-3 py-2 hover:bg-gray-50 border ${
                          selectedId === c.id ? 'bg-gray-100 border-gray-300' : 'border-transparent'
                        }`}
                      >
                        <div className="font-medium">{c.name || '(No name)'}</div>
                        <div className="text-xs text-gray-500">
                          {normalizeStage(c.stage)} • {(c.file_type || 'Type?')}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>

              {/* Right detail */}
              <section className="flex-1 pl-3 overflow-auto">
                {!selected && (
                  <div className="text-sm text-gray-500 h-full grid place-items-center">
                    {filteredClients.length === 0
                      ? 'No clients in this stage.'
                      : 'Select a client to see details.'}
                  </div>
                )}

                {selected && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">{selected.name || '(No name)'}</h2>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEditClient(selected)}
                          className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Info label="Phone" value={selected.phone} />
                      <Info label="Email" value={selected.email} />
                      <Info label="File Type" value={selected.file_type} />
                      <Info label="Stage" value={normalizeStage(selected.stage)} />
                      <Info label="Assigned To" value={selected.assigned_to} />
                      <Info label="Banker Name" value={selected.banker_name} />
                      <Info label="Banker Email" value={selected.banker_email} />
                      <Info label="Bank" value={selected.bank} />
                      <Info label="Lender" value={selected.lender} />
                      <Info label="Next Follow Up" value={selected.next_follow_up} />
                      <Info label="Last Contact" value={selected.last_contact} />
                      <Info label="Retainer Received" value={selected.retainer_received ? 'Yes' : 'No'} />
                      <Info label="Retainer Amount" value={selected.retainer_amount?.toString()} />
                      <Info label="Subject Removal Date" value={selected.subject_removal_date} />
                      <Info label="Closing Date" value={selected.closing_date} />
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-2">Notes</h3>
                      <p className="text-sm whitespace-pre-wrap">{selected.notes || '—'}</p>
                    </div>

                    {selected.notes_file_link && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">OneDrive Notes</h3>
                        <div className="aspect-video w-full border rounded-md overflow-hidden">
                          <iframe
                            key={selected.notes_file_link}
                            src={toOneDriveEmbed(selected.notes_file_link)}
                            className="w-full h-full"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </main>
          </>
        ) : (
          // ------------------ BOARD VIEW (KANBAN) ------------------
          <main className="min-h-[70vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              {PIPELINE_STAGES.map((stage) => {
                const colItems = clients.filter((c) => normalizeStage(c.stage) === stage);
                return (
                  <div
                    key={stage}
                    className="rounded-2xl border bg-white p-3 shadow-sm min-h-[320px] flex flex-col"
                    onDragOver={allowDrop}
                    onDrop={(e) => onDrop(e, stage)}
                    title={'Drag cards here'}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold">{stage}</div>
                      <div className="text-xs text-gray-500">{colItems.length}</div>
                    </div>

                    <div className="flex-1 space-y-2">
                      {colItems.length === 0 && (
                        <div className="text-xs text-gray-400 border border-dashed rounded-md p-3">—</div>
                      )}

                      {colItems.map((c) => (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, c.id)}
                          className="rounded-xl border px-3 py-2 hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                          onDoubleClick={() => onEditClient(c)}
                          title={'Drag to move stage • Double-click to edit'}
                        >
                          <div className="text-sm font-medium">{c.name || '(No name)'}</div>
                          <div className="text-xs text-gray-500">
                            {(c.file_type || 'Type?')} • {(c.assigned_to || 'Unassigned')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        )}
      </div>

      {/* Add/Edit Client Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {mode === 'edit' ? 'Edit Client' : 'Add Client'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingClient(null);
                  setMode('add');
                }}
                className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <ClientForm
              key={`form-${mode}-${editingClient?.id ?? 'new'}`}
              mode={mode}
              client={mode === 'edit' ? editingClient : null}
              onClose={() => {
                setShowForm(false);
                setEditingClient(null);
                setMode('add');
              }}
              onSaved={() => {
                refreshAll();
                setShowForm(false);
                setEditingClient(null);
                setMode('add');
              }}
              role={role}
            />
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showTaskForm && (
        <NewTaskModal
          onClose={() => setShowTaskForm(false)}
          onCreate={createTask}
          clients={clients}
        />
      )}
    </div>
  );
}

/* ===================== Components & Helpers ===================== */

function NewTaskModal({
  onClose,
  onCreate,
  clients,
}: {
  onClose: () => void;
  onCreate: (data: { title: string; client_id: string | null; assigned_to: string | null; due_date: string | null; notes: string | null; }) => void;
  clients: ClientRow[];
}) {
  const [title, setTitle] = useState('');
  const [client_id, setClientId] = useState<string>('');
  const [assigned_to, setAssignedTo] = useState<string>('Champa');
  const [due_date, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a task title.');
      return;
    }
    setSaving(true);
    await onCreate({
      title,
      client_id: client_id || null,
      assigned_to: assigned_to || null,
      due_date: due_date || null,
      notes: notes || null,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">New Task</h3>
          <button onClick={onClose} className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50">Close</button>
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <label className="text-sm block">
            <div className="text-gray-600 mb-1">Title *</div>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          <label className="text-sm block">
            <div className="text-gray-600 mb-1">Client (optional)</div>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={client_id}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">— None —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || '(No name)'}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm block">
              <div className="text-gray-600 mb-1">Assigned to</div>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={assigned_to}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option>Rajanpreet</option>
                <option>Champa</option>
              </select>
            </label>

            <label className="text-sm block">
              <div className="text-gray-600 mb-1">Due date</div>
              <input
                type="date"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={due_date}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>

          <label className="text-sm block">
            <div className="text-gray-600 mb-1">Notes (optional)</div>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

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
              className="rounded-md px-3 py-2 text-sm text-white"
              style={{ backgroundColor: BRAND }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function normalizeStage(stage?: string | null): string {
  const s = (stage || 'Lead').trim();
  if (s === 'Decision (Approved/Declined/More Info)') return 'More Info';
  return s;
}

/* ---------- Helpers ---------- */
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth();
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function humanAgo(then: Date, _tick: number) {
  const s = Math.floor((Date.now() - then.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
function getFilteredTasks(all: TaskRow[], filter: TaskFilter): TaskRow[] {
  const today = startOfDay(new Date());
  const in7 = addDays(today, 7);
  const openWithDue = (t: TaskRow) => t.status === 'open' && !!t.due_date;

  switch (filter) {
    case 'Open':
      return all.filter((t) => t.status === 'open');
    case 'Completed':
      return all.filter((t) => t.status === 'completed');
    case 'Overdue':
      return all.filter((t) => {
        if (!openWithDue(t)) return false;
        const due = startOfDay(new Date(t.due_date!));
        return due < today;
      });
    case 'Today':
      return all.filter((t) => {
        if (!openWithDue(t)) return false;
        const due = startOfDay(new Date(t.due_date!));
        return isSameDay(due, today);
      });
    case 'Upcoming':
      return all.filter((t) => {
        if (!openWithDue(t)) return false;
        const due = startOfDay(new Date(t.due_date!));
        return due > today && due <= in7;
      });
    case 'All':
    default:
      return all;
  }
}
function Card({ label, value, color }: { label: string; value: number; color: 'red' | 'amber' | 'emerald' }) {
  const bg = color === 'red' ? 'bg-red-50 border-red-200'
            : color === 'amber' ? 'bg-amber-50 border-amber-200'
            : 'bg-emerald-50 border-emerald-200';
  return (
    <div className={`rounded-2xl border p-3 ${bg} shadow-sm`}>
      <div className="text-xs uppercase tracking-wide text-gray-600">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
function SummaryCard({
  label, value, highlight = false,
}: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-3 ${highlight ? 'text-white' : 'bg-white'} shadow-sm`}
      style={highlight ? { backgroundColor: BRAND, borderColor: BRAND } : {}}
    >
      <div className={`text-xs uppercase tracking-wide ${highlight ? 'text-white/90' : 'text-gray-500'}`}>
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${highlight ? 'text-white' : ''}`}>{value}</div>
    </div>
  );
}
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${
        active ? 'text-white border-transparent' : 'bg-white hover:bg-gray-50'
      }`}
      style={active ? { backgroundColor: BRAND } : {}}
    >
      {label}
    </button>
  );
}
function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="text-sm">
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{value || '—'}</div>
    </div>
  );
}
function getInitials(s: string) {
  if (!s) return '?';
  const parts = s.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function formatYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

