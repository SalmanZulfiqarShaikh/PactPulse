import { Loader2 } from 'lucide-react'

import { cn } from '../../lib/cn'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS = {
  primary:
    'bg-accent-700 text-white hover:bg-accent-800 dark:bg-accent-600 dark:hover:bg-accent-500',
  secondary:
    'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800',
  ghost:
    'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800',
  danger: 'bg-red-700 text-white hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700',
  'danger-ghost':
    'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
}

/** Shared styling, so react-router <Link>s can look like buttons. */
export function buttonClasses({ variant = 'primary', size = 'md', className } = {}) {
  return cn(BASE, VARIANTS[variant] ?? VARIANTS.primary, SIZES[size] ?? SIZES.md, className)
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
