import { Badge } from './ui/Badge'
import { CONTRACT_STATUS_META } from '../lib/constants'

// Status is informational, so it stays in neutral tones rather than borrowing
// the severity palette. Only "failed" picks up colour, and it says so in words.
const TONE = {
  uploaded:
    'border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300',
  analyzing:
    'border-accent-200 bg-accent-50 text-accent-800 dark:border-accent-900 dark:bg-accent-950/50 dark:text-accent-300',
  analyzed:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  failed:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  not_started:
    'border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300',
}

const DOT = {
  uploaded: 'bg-stone-400',
  analyzing: 'bg-accent-600 dark:bg-accent-400',
  analyzed: 'bg-emerald-600 dark:bg-emerald-400',
  failed: 'bg-red-600 dark:bg-red-400',
  not_started: 'bg-stone-400',
}

const LABEL_OVERRIDES = {
  not_started: 'Not analyzed',
}

export function StatusBadge({ status, className }) {
  const key = String(status ?? '').toLowerCase()
  const label = LABEL_OVERRIDES[key] ?? CONTRACT_STATUS_META[key]?.label ?? 'Unknown'

  return (
    <Badge dot={DOT[key] ?? 'bg-stone-400'} className={`${TONE[key] ?? TONE.uploaded} ${className ?? ''}`}>
      {label}
    </Badge>
  )
}
