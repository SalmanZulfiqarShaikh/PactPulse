import { Link } from 'react-router-dom'
import { Scale } from 'lucide-react'

import { ThemeToggle } from './layout/ThemeToggle'
import { cn } from '../lib/cn'

// The heading, the card and the footer arrive in that order. Short delays: the
// sequence reads as one movement rather than three separate ones.
const ENTRANCE = 'animate-fade-up motion-reduce:animate-none'

/**
 * The frame for the sign-in and sign-up pages: a slim header so the way back to
 * the landing page is always visible, and one narrow column centred in what is
 * left. Nothing else competes with the form.
 *
 * The entrance is a plain CSS animation rather than the scroll reveal used on
 * the landing page. Everything here is above the fold by definition, so an
 * IntersectionObserver would only add a way for content to get stuck invisible.
 */
export function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 dark:bg-stone-950">
      <header className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
        >
          <Scale className="h-5 w-5 text-accent-700 dark:text-accent-400" aria-hidden="true" />
          Pact Pulse
        </Link>

        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <div className={ENTRANCE}>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">{description}</p>
            )}
          </div>

          <div
            style={{ animationDelay: '70ms' }}
            className={cn(
              ENTRANCE,
              'mt-6 rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900',
            )}
          >
            {children}
          </div>

          {footer && (
            <p
              style={{ animationDelay: '140ms' }}
              className={cn(
                ENTRANCE,
                'mt-5 text-center text-sm text-stone-600 dark:text-stone-400',
              )}
            >
              {footer}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
