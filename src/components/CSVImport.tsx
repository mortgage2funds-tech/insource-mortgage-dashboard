
'use client'
import React, { useRef, useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { Upload } from 'lucide-react'

type Row = Record<string, string>

export default function CSVImport({ onDone }:{ onDone?:()=>void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setBusy(true); setMsg(null)
    try {
      const parsed = await new Promise<Row[]>((resolve, reject) => {
        Papa.parse<Row>(file, { header: true, skipEmptyLines: true,
          complete: (res)=> resolve(res.data), error: reject })
      })
      const payload = parsed.map(r => ({
        name: r['Client Name'] || '',
        email: r['Email'] || '',
        phone: r['Phone'] || '',
        lender: r['Lender'] || '',
        file_type: r['File Type'] || 'Residential',
        stage: r['Stage'] || 'Lead',
        next_follow_up: r['Next Follow-Up Date'] || null,
        assigned_to: r['Assigned To'] || 'Assistant',
        last_contact: r['Last Contact Date'] || null,
        notes: r['Notes'] || '',
        banker_name: r['Banker Name'] || '',
        banker_email: r['Banker Email'] || '',
        bank: r['Bank'] || '',
      })).filter(r => r.name)

      if (payload.length === 0) {
        setMsg('No valid rows found. Check headers and try again.')
      } else {
        const { error } = await supabase.from('clients').insert(payload)
        if (error) throw error
        setMsg(`Imported ${payload.length} clients successfully.`)
        onDone && onDone()
      }
    } catch (e:any) {
      setMsg(e.message || String(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Import from Excel (CSV)</div>
        <button className="btn" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="h-4 w-4 mr-2" />{busy ? 'Importing…' : 'Choose CSV'}
        </button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
      <p className="text-sm text-gray-600">
        Headers must match: Client Name, Email, Phone, Lender, <b>File Type</b>, Stage, Next Follow-Up Date, Assigned To, Last Contact Date, Notes, Banker Name, Banker Email, Bank
      </p>
      {msg && <div className="mt-2 text-sm rounded-xl border p-2 bg-gray-50">{msg}</div>}
    </div>
  )
}
