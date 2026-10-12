import { cn } from '../../lib/cn'

/** A bordered surface. Borders, not shadows, do the separating throughout. */
export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 px-5 py-4 dark:border-stone-800',
        className,
      )}
    >
      <div className="min-w-0">
        {title && <h2 className="text-sm font-semibold">{title}</h2>}
        {description && (
          <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}
