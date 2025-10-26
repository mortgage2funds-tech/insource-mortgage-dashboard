
import React from 'react'

export const STAGES = [
  'Lead',
  'Checklist Sent',
  'Docs Received',
  'Structuring Phase',
  'Ready to Send to Banker',
  'Sent to Banker',
  'Decision (Approved/Declined/More Info)',
  'Completed'
] as const


export function StageBadge({ stage }: { stage?: string }) {
  if (!stage) return <span className="badge">—</span>
  const map: Record<string,string> = {
    'Numbers done': 'badge badge-warning',
    'Ready to send to banker': 'badge badge-success',
    'Sent to banker': 'badge badge-secondary',
  }
  const cls = map[stage] || 'badge'
  return <span className={cls}>{stage}</span>
}
