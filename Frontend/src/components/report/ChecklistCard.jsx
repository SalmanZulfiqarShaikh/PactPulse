import { AlertTriangle, CheckCircle2, CircleDashed, MinusCircle } from 'lucide-react'

import { Card, CardBody, CardHeader } from '../ui/Card'
import { CHECK_STATUS_META } from '../../lib/constants'
import { cn } from '../../lib/cn'

const ICONS = {
  needs_attention: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
  missing: { icon: CircleDashed, className: 'text-orange-600 dark:text-orange-400' },
  fine: { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  not_applicable: { icon: MinusCircle, className: 'text-stone-400 dark:text-stone-500' },
}

/**
 * The fixed clause checklist. Every report answers the same twelve questions,
 * so two runs (or two contracts) can be compared line by line, and a missing
 * protection is reported every time rather than only when the model notices.
 */
export function ChecklistCard({ items }) {
  if (!items?.length) return null

  const sorted = [...items].sort(
    (a, b) => (CHECK_STATUS_META[a.status]?.rank ?? 9) - (CHECK_STATUS_META[b.status]?.rank ?? 9),
  )
  const attention = items.filter((item) => item.status === 'needs_attention').length
  const missing = items.filter((item) => item.status === 'missing').length

  return (
    <Card>
      <CardHeader
        title="Clause checklist"
        description={`The same ${items.length} checks on every contract. ${attention} need attention, ${missing} not covered.`}
      />
      <CardBody>
        <ul className="divide-y divide-stone-200 dark:divide-stone-800">
          {sorted.map((item) => {
            const { icon: Icon, className } = ICONS[item.status] ?? ICONS.not_applicable
            return (
              <li key={item.key} className="flex items-start gap-3 py-3">
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      {CHECK_STATUS_META[item.status]?.label ?? item.status}
                    </p>
                  </div>
                  {item.note && (
                    <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                      {item.note}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}
