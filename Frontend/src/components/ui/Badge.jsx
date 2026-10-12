import { cn } from '../../lib/cn'

/**
 * A small labelled pill. Callers pass the tone classes; the label is always
 * text, never colour alone.
 */
export function Badge({ className, dot, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />}
      {children}
    </span>
  )
}
