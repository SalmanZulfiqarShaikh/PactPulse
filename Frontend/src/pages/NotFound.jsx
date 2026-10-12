import { Link } from 'react-router-dom'
import { FileQuestion, Scale } from 'lucide-react'

import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { buttonClasses } from '../components/ui/Button'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { useAuth } from '../context/AuthContext'

/**
 * The catch-all route. It sits outside the app shell, so it carries its own
 * minimal header rather than assuming a sidebar is on the page.
 */
export function NotFound() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 dark:bg-stone-950">
      <header className="flex h-14 items-center justify-between gap-4 border-b border-stone-200 px-4 sm:px-6 dark:border-stone-800">
        <Link to="/" className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-accent-700 dark:text-accent-400" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-tight">Pact Pulse</span>
        </Link>

        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 items-start px-4 py-12 sm:px-6">
        <Card className="w-full">
          <EmptyState
            icon={FileQuestion}
            title="Page not found"
            description="That address does not match anything in Pact Pulse."
            action={
              <Link
                to={isAuthenticated ? '/app' : '/'}
                className={buttonClasses({ variant: 'primary' })}
              >
                {isAuthenticated ? 'Back to contracts' : 'Back to the homepage'}
              </Link>
            }
          />
        </Card>
      </main>
    </div>
  )
}
