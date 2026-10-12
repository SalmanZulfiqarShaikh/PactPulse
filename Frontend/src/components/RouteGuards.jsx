import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui/Spinner'

/**
 * Shown for the moment between the first render and the refresh cookie being
 * exchanged. Neutral on purpose: it must not read as either signed in or
 * signed out, because we do not know yet.
 */
function SessionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
      <p className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-400" role="status">
        <Spinner />
        Loading Pact Pulse…
      </p>
    </div>
  )
}

/**
 * Everything under /app. Waits for the session check, then either renders the
 * page or sends the visitor to the login screen with the address they asked
 * for, so signing in returns them to it rather than dumping them on the
 * dashboard.
 */
export function RequireAuth() {
  const { isAuthenticated, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <SessionLoading />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}

/**
 * The login and register pages. Someone who already has a session has no use
 * for them, so they go straight to the app.
 */
export function PublicOnly() {
  const { isAuthenticated, status } = useAuth()

  if (status === 'loading') return <SessionLoading />
  if (isAuthenticated) return <Navigate to="/app" replace />

  return <Outlet />
}
