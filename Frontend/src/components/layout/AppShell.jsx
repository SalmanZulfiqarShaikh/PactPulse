import { Outlet } from 'react-router-dom'
import { Scale } from 'lucide-react'

import { MobileNav, Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

/**
 * The frame every page sits in: a fixed sidebar from `md` up, a bottom bar
 * below it, and one thin top bar carrying the theme switch.
 */
export function AppShell() {
  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-stone-950">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-stone-200 bg-stone-50/95 px-4 backdrop-blur sm:px-6 dark:border-stone-800 dark:bg-stone-950/95">
          <div className="flex items-center gap-2 md:hidden">
            <Scale className="h-5 w-5 text-accent-700 dark:text-accent-400" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-tight">Pact Pulse</span>
          </div>

          {/* Keeps the toggle right-aligned when the brand is hidden. */}
          <div className="hidden md:block" />

          <ThemeToggle />
        </header>

        {/* pb-20 clears the mobile bottom bar. */}
        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>

        <MobileNav />
      </div>
    </div>
  )
}

/** Shared page container, so every page lines up on the same grid. */
export function PageContainer({ children, className }) {
  return (
    <div className={'mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 ' + (className ?? '')}>
      {children}
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
