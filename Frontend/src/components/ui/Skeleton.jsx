import { cn } from '../../lib/cn'

export function Skeleton({ className }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-stone-200 dark:bg-stone-800', className)}
      aria-hidden="true"
    />
  )
}

/** Placeholder rows matching the dashboard table's shape. */
export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="divide-y divide-stone-200 dark:divide-stone-800" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-5 py-4">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-4', columnIndex === 0 ? 'w-2/5' : 'w-1/6')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Placeholder cards for the mobile contract list. */
export function CardSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-stone-200 p-4 dark:border-stone-800"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-3 w-1/3" />
          <Skeleton className="mt-3 h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
