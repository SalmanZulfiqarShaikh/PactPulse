import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, LogOut, RefreshCw, ServerCrash } from 'lucide-react'

import { PageContainer, PageHeader } from '../components/layout/AppShell'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Spinner } from '../components/ui/Spinner'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/constants'

/** The result of the last reachability check, rendered as one line. */
function HealthRow({ state, onCheck }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5 text-sm" role="status" aria-live="polite">
        {state === 'checking' && (
          <>
            <Spinner />
            <span className="text-stone-600 dark:text-stone-400">Checking…</span>
          </>
        )}

        {state === 'ok' && (
          <>
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span className="text-stone-800 dark:text-stone-200">Reachable</span>
          </>
        )}

        {state === 'error' && (
          <>
            <ServerCrash
              className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <span className="text-stone-800 dark:text-stone-200">Not reachable</span>
          </>
        )}

        {state === 'idle' && (
          <span className="text-stone-600 dark:text-stone-400">Not checked yet</span>
        )}
      </div>

      <Button variant="secondary" size="sm" onClick={onCheck} loading={state === 'checking'}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Check again
      </Button>
    </div>
  )
}

export function AccountPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [health, setHealth] = useState('idle')
  const [healthError, setHealthError] = useState(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const checkHealth = useCallback(async () => {
    setHealth('checking')
    setHealthError(null)

    try {
      // `GET /` is the API index and the only endpoint that needs no session, so
      // it answers "is the server there" without touching account data.
      await api.health()
      setHealth('ok')
    } catch (error) {
      setHealthError(error)
      setHealth('error')
    }
  }, [])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Account"
        description="Your sign-in details, and whether the server is answering."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Signed in as" />

          <CardBody className="space-y-4">
            <dl>
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase dark:text-stone-400">
                Email
              </dt>
              <dd className="mt-0.5 text-sm break-all">{user?.email || 'Not available'}</dd>
            </dl>

            <p className="max-w-prose text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              Your contracts are private to this account. Logging out clears the session from this
              browser, and the next visit asks you to sign in again.
            </p>

            <Button variant="secondary" onClick={handleLogout} loading={loggingOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Backend"
            description="The API this app is talking to, and its current state."
          />

          <CardBody className="space-y-4">
            <dl>
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase dark:text-stone-400">
                Address
              </dt>
              <dd className="mt-0.5">
                <code className="text-xs break-all">{API_BASE_URL}</code>
              </dd>
            </dl>

            <HealthRow state={health} onCheck={checkHealth} />

            {healthError && (
              <Alert tone="danger" title="The check failed">
                {healthError.message}
              </Alert>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Changing your password" />
          <CardBody>
            <p className="max-w-prose text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              Not available yet. There is no password reset by email, and no way to change a password
              from this page.
            </p>
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  )
}
