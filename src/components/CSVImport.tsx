'use client';

import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { createClient } from '../lib/supabase';

type Row = Record<string, string>;

export default function CSVImport() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState<string>('');

  // Ready if we ever need it (not used unless you wire an insert)
  const supabase = createClient();

  function handlePick() {
    fileRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setMessage('');
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data || []).filter(Boolean);
        const hdrs = res.meta.fields || [];
        setRows(data);
        setHeaders(hdrs);
        setParsing(false);
        setMessage(`Parsed ${data.length} rows (${hdrs.length} columns).`);
      },
      error: (err) => {
        setParsing(false);
        setMessage(`Parse error: ${err.message}`);
      }
    });
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold">CSV Import</div>
        <div className="text-xs text-gray-600">Preview only (DB insert disabled in this build)</div>
      </div>

      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

      <div className="flex items-center gap-2">
        <button onClick={handlePick} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
          Choose CSV…
        </button>
        {parsing && <span className="text-sm text-gray-600">Parsing…</span>}
        {message && <span className="text-sm text-gray-700">{message}</span>}
      </div>

      {headers.length > 0 && (
        <div className="mt-4 overflow-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="border-b px-2 py-1 text-xs text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  {headers.map((h) => (
                    <td key={h} className="px-2 py-1">{r[h] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && (
            <div className="p-2 text-xs text-gray-600">Showing first 20 of {rows.length} rows.</div>
          )}
        </div>
      )}
    </div>
  );
}
