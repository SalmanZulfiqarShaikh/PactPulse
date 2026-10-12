import { Monitor, Moon, Sun } from 'lucide-react'

import { cn } from '../../lib/cn'
import { useTheme } from '../../context/ThemeContext'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/** A three-way switch. Each button carries its label as accessible text. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex rounded-md border border-stone-200 p-0.5 dark:border-stone-800"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value

        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={isActive}
            title={label}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors',
              isActive
                ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
