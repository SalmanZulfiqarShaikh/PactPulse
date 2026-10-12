// Severity is the only place the UI uses saturated colour. Each badge always
// carries its text label, so severity is never communicated by colour alone.
//
// The labels are the plain-language names for the API's four levels. They say
// what the reader should do rather than how the model rated the clause -
// "Serious problem" is actionable where "critical" is a grading.
export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

export const SEVERITY_META = {
  critical: {
    label: 'Serious problem',
    rank: 0,
    badge:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900',
    dot: 'bg-red-600 dark:bg-red-400',
  },
  high: {
    label: 'Important',
    rank: 1,
    badge:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900',
    dot: 'bg-orange-600 dark:bg-orange-400',
  },
  medium: {
    label: 'Worth a look',
    rank: 2,
    badge:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
  low: {
    label: 'Minor',
    rank: 3,
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
  },
}

const UNCLASSIFIED = {
  label: 'Unclassified',
  rank: 4,
  badge:
    'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
  dot: 'bg-stone-500 dark:bg-stone-400',
}

/** Metadata for a severity value, tolerating unknown or missing ones. */
export function severityMeta(value) {
  const key = String(value ?? '').toLowerCase()
  return SEVERITY_META[key] ?? (value ? { ...UNCLASSIFIED, label: String(value) } : UNCLASSIFIED)
}

/** Worst first. Unknown severities sort last rather than being dropped. */
export function sortRisks(risks = []) {
  return [...risks].sort(
    (a, b) => severityMeta(a?.severity).rank - severityMeta(b?.severity).rank,
  )
}

/** Counts per severity, for the summary strip above the risk list. */
export function countBySeverity(risks = []) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, other: 0 }

  for (const risk of risks) {
    const key = String(risk?.severity ?? '').toLowerCase()
    if (key in counts) counts[key] += 1
    else counts.other += 1
  }

  return counts
}
