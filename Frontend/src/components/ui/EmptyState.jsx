import { cn } from '../../lib/cn'

/**
 * Shown when a request succeeded but there is nothing to list. The icon is a
 * plain document glyph, not a sparkle - the subject is the contract.
 */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-stone-200 text-stone-400 dark:border-stone-800 dark:text-stone-500">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}

      <h3 className="mt-4 text-sm font-semibold">{title}</h3>

      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-stone-600 dark:text-stone-400">
          {description}
        </p>
      )}

      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
