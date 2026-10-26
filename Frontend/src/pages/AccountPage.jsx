import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { PageContainer, PageHeader } from '../components/layout/AppShell'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

export function AccountPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Account" description="Your sign-in details." />

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
            Your contracts are private to this account. Logging out signs you out of this browser.
          </p>

          <Button variant="secondary" onClick={handleLogout} loading={loggingOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </Button>
        </CardBody>
      </Card>
    </PageContainer>
  )
}
