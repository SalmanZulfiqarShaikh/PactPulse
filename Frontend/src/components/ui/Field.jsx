import { useId } from 'react'

import { cn } from '../../lib/cn'

/** A label + control + hint/error wrapper. The label is always programmatic. */
export function Field({ label, hint, error, required, className, children }) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && (
          <span className="ml-1 text-red-700 dark:text-red-400" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {typeof children === 'function'
        ? children({
            id,
            'aria-describedby': describedBy || undefined,
            'aria-invalid': error ? true : undefined,
          })
        : children}

      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-stone-500 dark:text-stone-400">
          {hint}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
