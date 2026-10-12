import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AuthLayout } from '../components/AuthLayout'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { useAuth } from '../context/AuthContext'
import { normaliseEmail, validateEmail, validatePassword } from '../lib/credentials'

// One validator per field, so the same rule runs whether it was triggered by a
// blur, a keystroke or the submit button.
const VALIDATORS = { email: validateEmail, password: validatePassword }

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Where the visitor was headed before the guard intercepted them. Only a path
  // is ever stored, never a full URL, so this cannot be used to bounce someone
  // to another origin.
  const returnTo = location.state?.from || '/app'

  /**
   * Re-check a field while it is being typed in, but only after the reader has
   * left it once. Before that a half-typed address reads as invalid, and being
   * corrected mid-word is worse than being corrected late: the message appears
   * the moment the value becomes valid, without waiting for another blur.
   */
  function handleChange(field, value, setValue) {
    setValue(value)
    setFormError(null)
    if (!touched[field]) return
    setFieldErrors((current) => ({ ...current, [field]: VALIDATORS[field](value) }))
  }

  function handleBlur(field, value) {
    setTouched((current) => ({ ...current, [field]: true }))
    setFieldErrors((current) => ({ ...current, [field]: VALIDATORS[field](value) }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const errors = {
      email: validateEmail(email),
      password: validatePassword(password),
    }

    // Submitting counts as visiting every field, so anything still wrong keeps
    // correcting itself as it is typed.
    setTouched({ email: true, password: true })

    if (errors.email || errors.password) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      await login({ email: normaliseEmail(email), password })
      navigate(returnTo, { replace: true })
    } catch (error) {
      // The API client already prefers the server's own message, which is what
      // a wrong password returns.
      setFormError(error?.message ?? 'Could not sign in. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Contract analysis for your firm's documents."
      footer={
        <>
          No account yet?{' '}
          <Link
            to="/register"
            state={location.state}
            className="font-medium text-accent-700 underline-offset-2 hover:underline dark:text-accent-400"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <div className="animate-fade-in motion-reduce:animate-none">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}

        <Field label="Email" error={fieldErrors.email} required>
          {(props) => (
            <Input
              {...props}
              type="email"
              name="email"
              value={email}
              autoComplete="email"
              autoFocus
              placeholder="you@firm.com"
              onChange={(event) => handleChange('email', event.target.value, setEmail)}
              onBlur={() => handleBlur('email', email)}
            />
          )}
        </Field>

        <Field label="Password" error={fieldErrors.password} required>
          {(props) => (
            <PasswordInput
              {...props}
              name="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => handleChange('password', event.target.value, setPassword)}
              onBlur={() => handleBlur('password', password)}
            />
          )}
        </Field>

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
