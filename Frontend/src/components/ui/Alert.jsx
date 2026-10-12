import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

import { cn } from '../../lib/cn'

const TONES = {
  info: {
    icon: Info,
    className:
      'border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300',
    iconClassName: 'text-stone-500 dark:text-stone-400',
  },
  success: {
    icon: CheckCircle2,
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    iconClassName: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    className:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    iconClassName: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    icon: XCircle,
    className:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    iconClassName: 'text-red-600 dark:text-red-400',
  },
}

/**
 * An inline message. `danger` is used for API failures, so it accepts an
 * `action` slot for a retry button.
 */
export function Alert({ tone = 'info', title, children, action, className }) {
  const config = TONES[tone] ?? TONES.info
  const Icon = config.icon

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', config.className, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', config.iconClassName)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-1', 'leading-relaxed')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
