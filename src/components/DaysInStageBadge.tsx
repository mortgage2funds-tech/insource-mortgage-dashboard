import * as React from "react";

/**
 * Props:
 *  - enteredAt: string | null | undefined  (ISO timestamp from current_stage_entry.entered_stage_at)
 *  - fallbackDate: string | null | undefined (ISO timestamp to use if enteredAt is null; e.g., clients.updated_at)
 *  - stageLabel: string (optional, for tooltip)
 */
export default function DaysInStageBadge({
  enteredAt,
  fallbackDate,
  stageLabel,
}: {
  enteredAt?: string | null;
  fallbackDate?: string | null;
  stageLabel?: string;
}) {
  const base = enteredAt ?? fallbackDate ?? null;

  const days = React.useMemo(() => {
    if (!base) return null;
    const start = new Date(base);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    // convert ms to whole days
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }, [enteredAt, fallbackDate]);

  if (days === null) {
    return null; // nothing to show
  }

  // thresholds: 0–2: neutral, 3–6: yellow, >=7: red
  let color =
    "bg-gray-100 text-gray-800 ring-1 ring-inset ring-gray-200";
  if (days >= 3 && days < 7) {
    color = "bg-yellow-100 text-yellow-800 ring-1 ring-inset ring-yellow-200";
  } else if (days >= 7) {
    color = "bg-red-100 text-red-800 ring-1 ring-inset ring-red-200";
  }

  const title = stageLabel
    ? `In “${stageLabel}” for ${days} day${days === 1 ? "" : "s"}`
    : `${days} day${days === 1 ? "" : "s"} in stage`;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
      title={title}
    >
      {days}d
    </span>
  );
}

