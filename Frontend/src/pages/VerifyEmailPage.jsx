import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AuthLayout } from '../components/AuthLayout'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { normaliseEmail, validateEmail } from '../lib/credentials'

const RESEND_SECONDS = 60

/**
 * Step two of sign-up: the 6-digit code from the email. Reached from the
 * register page, or from login when the account isn't verified yet.
 */
export function VerifyEmailPage() {
  const { verifyEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const knownEmail = location.state?.email ?? ''
  const returnTo = location.state?.from || '/app'

  const [email, setEmail] = useState(knownEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(
    location.state?.resent ? 'Your email isn’t verified yet, so we’ve sent you a new code.' : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(knownEmail ? RESEND_SECONDS : 0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function submit(value = code) {
    const address = normaliseEmail(email)
    const emailError = validateEmail(address)
    if (emailError) {
      setError(emailError)
      return
    }
    if (!/^\d{6}$/.test(value)) {
      setError('Enter the 6-digit code from the email.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await verifyEmail({ email: address, code: value })
      navigate(returnTo, { replace: true })
    } catch (requestError) {
      setError(requestError?.message ?? 'Could not verify the code. Try again.')
      setSubmitting(false)
    }
  }

  async function resend() {
    const address = normaliseEmail(email)
    const emailError = validateEmail(address)
    if (emailError) {
      setError(emailError)
      return
    }
    setError(null)
    try {
      await api.resendCode(address)
      setNotice(`We’ve sent a new code to ${address}.`)
      setCode('')
      setCooldown(RESEND_SECONDS)
    } catch (requestError) {
      setError(requestError?.message ?? 'Could not send a new code.')
    }
  }

  function handleCodeChange(event) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    setError(null)
    // A pasted or fully typed code submits itself.
    if (digits.length === 6 && !submitting) submit(digits)
  }

  return (
    <AuthLayout
      title="Check your email"
      description={
        knownEmail
          ? `We’ve sent a 6-digit code to ${knownEmail}. It expires in 10 minutes.`
          : 'Enter your email and the 6-digit code we sent you.'
      }
      footer={
        <>
          Wrong address?{' '}
          <Link
            to="/register"
            className="font-medium text-accent-700 underline-offset-2 hover:underline dark:text-accent-400"
          >
            Sign up again
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && !error && <Alert tone="info">{notice}</Alert>}

        {!knownEmail && (
          <Field label="Email" required>
            {(props) => (
              <Input
                {...props}
                type="email"
                value={email}
                autoComplete="email"
                placeholder="you@firm.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
        )}

        <Field label="Verification code" required>
          {(props) => (
            <Input
              {...props}
              value={code}
              onChange={handleCodeChange}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus={Boolean(knownEmail)}
              maxLength={6}
              placeholder="000000"
              className="text-center text-2xl font-semibold tracking-[0.5em] tabular-nums"
            />
          )}
        </Field>

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          {submitting ? 'Checking…' : 'Verify and continue'}
        </Button>

        <p className="text-center text-sm text-stone-600 dark:text-stone-400">
          Didn’t get it? Check spam, or{' '}
          {cooldown > 0 ? (
            <span>send a new code in {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={resend}
              className="font-medium text-accent-700 underline-offset-2 hover:underline dark:text-accent-400"
            >
              send a new code
            </button>
          )}
        </p>
      </form>
    </AuthLayout>
  )
}
