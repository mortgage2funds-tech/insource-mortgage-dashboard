'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';

type Hist = { client_id: string; from_stage: string | null; to_stage: string | null; changed_at: string; };
type ClientLite = { id: string; name: string | null };

const STAGES = [
  'Lead','Checklist Sent','Docs Received','Structuring Phase','Ready to Send to Banker',
  'Sent to Banker','More Info','Approved','Declined','Completed',
];

export default function AnalyticsPage() {
  const supabase = createClient();
  const [hist, setHist] = useState<Hist[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) Load history (ordered)
      const { data: h } = await supabase
        .from('client_stage_history')
        .select('client_id, from_stage, to_stage, changed_at')
        .order('client_id', { ascending: true })
        .order('changed_at', { ascending: true });

      // 2) Load a light list of clients (id + name) once
      const { data: c } = await supabase
        .from('clients')
        .select('id, name');

      setHist((h ?? []) as Hist[]);
      setClients((c ?? []) as ClientLite[]);
      setLoading(false);
    })();
  }, [supabase]);

  // id -> name map
  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clients) m[c.id] = c.name || '';
    return m;
  }, [clients]);

  const metrics = useMemo(() => {
    // Build per-client sequences
    const byClient: Record<string, Hist[]> = {};
    for (const r of hist) {
      if (!byClient[r.client_id]) byClient[r.client_id] = [];
      byClient[r.client_id].push(r);
    }
    // For each client, compute durations between consecutive entries
    const durations: Record<string, number[]> = {}; // stage -> [days...]
    for (const cid of Object.keys(byClient)) {
      const seq = byClient[cid].sort((a,b)=>new Date(a.changed_at).getTime()-new Date(b.changed_at).getTime());
      for (let i=0;i<seq.length-1;i++){
        const cur = seq[i];
        const nxt = seq[i+1];
        const stage = cur.to_stage ?? 'Lead';
        const days = Math.max(0, (new Date(nxt.changed_at).getTime() - new Date(cur.changed_at).getTime()) / (1000*60*60*24));
        if (!durations[stage]) durations[stage] = [];
        durations[stage].push(days);
      }
    }
    // Average per stage
    const rows = STAGES.map(s => {
      const arr = durations[s] ?? [];
      const avg = arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
      return { stage: s, samples: arr.length, avgDays: avg };
    });
    return rows;
  }, [hist]);

  const maxAvg = Math.max(1, ...metrics.map(m=>m.avgDays));

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Analytics — Stage Timing</h1>
        <a href="/" className="text-sm text-blue-700 hover:underline">← Back to Dashboard</a>
      </div>

      {loading && <div className="rounded-xl border bg-white p-4">Loading…</div>}

      {!loading && (
        <div className="space-y-4">
          {/* Bar list */}
          <div className="space-y-2 rounded-2xl border bg-white p-4">
            <div className="mb-2 text-sm text-gray-600">Average days spent in each stage (based on history)</div>
            {metrics.map(row => (
              <div key={row.stage} className="grid grid-cols-5 items-center gap-3">
                <div className="col-span-2 text-sm">{row.stage}</div>
                <div className="col-span-3">
                  <div className="h-3 rounded-full bg-gray-100">
                    <div
                      className="h-3 rounded-full bg-blue-600"
                      style={{ width: `${(row.avgDays/maxAvg)*100}%` }}
                      title={`${row.avgDays.toFixed(2)} days`}
                    />
                  </div>
                </div>
                <div className="col-span-5 flex justify-between text-xs text-gray-600">
                  <div>Avg: {row.avgDays.toFixed(2)} days</div>
                  <div>Samples: {row.samples}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Raw table with names */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="mb-2 text-sm font-medium">History (latest 200 rows)</div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-600">
                  <th className="py-1">Client</th>
                  <th className="py-1">From</th>
                  <th className="py-1">To</th>
                  <th className="py-1">Changed at</th>
                </tr>
              </thead>
              <tbody>
                {hist.slice(-200).map((h, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-1">
                      {nameById[h.client_id] ? nameById[h.client_id] : <span className="text-gray-500">{h.client_id}</span>}
                    </td>
                    <td className="py-1">{h.from_stage ?? '—'}</td>
                    <td className="py-1">{h.to_stage ?? '—'}</td>
                    <td className="py-1">{new Date(h.changed_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
