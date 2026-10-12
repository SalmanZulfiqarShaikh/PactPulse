import { forwardRef } from 'react'

import { cn } from '../../lib/cn'

const INPUT_CLASSES =
  'block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/40 disabled:cursor-not-allowed disabled:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 dark:disabled:bg-stone-800'

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(INPUT_CLASSES, className)} {...props} />
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(INPUT_CLASSES, 'pr-8', className)} {...props}>
      {children}
    </select>
  )
})
