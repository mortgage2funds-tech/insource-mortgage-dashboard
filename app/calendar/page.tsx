'use client';

import { useEffect, useState } from 'react';

export default function CalendarPage() {
  const [icsUrl, setIcsUrl] = useState<string>('');

  useEffect(() => {
    // Build absolute URL to the ICS endpoint (works locally and after deploy)
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    setIcsUrl(`${origin}/api/tasks-ics`);
  }, []);

  function copy() {
    navigator.clipboard.writeText(icsUrl).then(() => {
      alert('Copied calendar link!');
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-xl font-semibold mb-2">Subscribe in Google Calendar</h1>

      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="text-sm text-gray-600">
          This read-only calendar shows all <b>open tasks with a due date</b> from the dashboard.
          It updates automatically in Google Calendar.
        </div>

        <div className="text-sm">
          <div className="mb-1 text-gray-600">Subscription URL</div>
          <div className="flex gap-2">
            <input
              value={icsUrl}
              readOnly
              className="flex-1 rounded-md border px-3 py-2 text-sm"
            />
            <button
              onClick={copy}
              className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="text-sm">
          <div className="mb-1 font-medium">How to add in Google Calendar:</div>
          <ol className="list-decimal pl-5 space-y-1 text-gray-700">
            <li>Open <b>Google Calendar</b>.</li>
            <li>On the left, click <b>“Other calendars” → “+” → “From URL”</b>.</li>
            <li>Paste the link above and click <b>Add calendar</b>.</li>
            <li>It will appear under “Other calendars” as <i>Insource Tasks</i> (you can rename).</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

