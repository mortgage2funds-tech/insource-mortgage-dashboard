import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Very small helper to build ICS text safely
function escapeText(s: string) {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// Format YYYY-MM-DD -> YYYYMMDD (all-day)
function ymd(str: string) {
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export async function GET() {
  // 1) Pull open tasks with a due_date
  const { data: tasks, error: tErr } = await supabaseAdmin
    .from('tasks')
    .select('id, title, client_id, due_date, status, notes')
    .eq('status', 'open')
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true });

  if (tErr) {
    return new NextResponse(`Failed to load tasks: ${tErr.message}`, { status: 500 });
  }

  // 2) Pull client names to enrich titles
  const clientIds = Array.from(new Set(tasks?.map(t => t.client_id).filter(Boolean) as string[]));
  let clientMap: Record<string, string> = {};
  if (clientIds.length) {
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('id, name')
      .in('id', clientIds);

    for (const c of clients || []) {
      if (c.id) clientMap[c.id] = c.name || '';
    }
  }

  // 3) Build ICS content
  const lines: string[] = [];
  const now = new Date();
  const dtstamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    'T' +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0') +
    'Z';

  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Insource Mortgage Dashboard//Tasks//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');

  for (const t of tasks || []) {
    const due = ymd(t.due_date as string);
    if (!due) continue;

    const clientName = t.client_id ? clientMap[t.client_id] : '';
    const summary = clientName
      ? `${t.title} — ${clientName}`
      : t.title;

    lines.push('BEGIN:VEVENT');
    // All-day event on due date (DTEND is next day for all-day ICS)
    lines.push(`DTSTART;VALUE=DATE:${due}`);
    // compute next day:
    const d = new Date(t.due_date as string);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const nextStr = ymd(next.toISOString());
    lines.push(`DTEND;VALUE=DATE:${nextStr}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`UID:${t.id}@insource`);
    lines.push(`SUMMARY:${escapeText(summary)}`);
    if (t.notes) lines.push(`DESCRIPTION:${escapeText(t.notes)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  const body = lines.join('\r\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="insource-tasks.ics"',
      'Cache-Control': 'no-store',
    },
  });
}

