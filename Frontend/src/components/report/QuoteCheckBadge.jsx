import { BadgeCheck, SearchX, TextSearch } from 'lucide-react'

import { Badge } from '../ui/Badge'

const META = {
  exact: {
    label: 'Found in document',
    icon: BadgeCheck,
    title: 'This quote appears word for word in the document.',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  close: {
    label: 'Close match',
    icon: TextSearch,
    title:
      'A passage almost identical to this quote was found (small differences, e.g. from scanning). Compare it with the original.',
    className:
      'border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300',
  },
  not_found: {
    label: 'Quote not found',
    icon: SearchX,
    title:
      'This wording could not be found in the document. The AI may have paraphrased or invented it - check the original before relying on this finding.',
    className:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  },
}

/** Whether the server could find a finding's quote in the source text. */
export function QuoteCheckBadge({ check }) {
  const meta = META[check?.status]
  if (!meta) return null
  const Icon = meta.icon

  return (
    <span title={meta.title}>
      <Badge className={meta.className}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        {meta.label}
      </Badge>
    </span>
  )
}
