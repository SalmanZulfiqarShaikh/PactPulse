import { useId, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, Circle } from 'lucide-react'

import { AuthLayout } from '../components/AuthLayout'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { useAuth } from '../context/AuthContext'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../lib/constants'
import { cn } from '../lib/cn'
import { normaliseEmail, validateEmail, validatePassword } from '../lib/credentials'

// One validator per field, so the same rule runs whether it was triggered by a
// blur, a keystroke or the submit button.
const VALIDATORS = { email: validateEmail, password: validatePassword }

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const rulesId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const returnTo = location.state?.from || '/app'

  // The same limits the backend enforces, shown as they are satisfied. An empty
  // field has satisfied nothing, so the upper limit counts only once there is
  // something in the box - a tick next to a blank field would read as progress.
  const rules = [
    {
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    {
      label: `At most ${MAX_PASSWORD_LENGTH} characters`,
      met: password.length > 0 && password.length <= MAX_PASSWORD_LENGTH,
    },
  ]

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
      const address = normaliseEmail(email)
      await register({ email: address, password })
      navigate('/verify', { state: { email: address, from: returnTo } })
    } catch (error) {
      // A duplicate address comes back as 409 with the server's own wording,
      // which is clearer than anything written here.
      setFormError(error?.message ?? 'Could not create the account. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Your contracts are visible only to you."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            state={location.state}
            className="font-medium text-accent-700 underline-offset-2 hover:underline dark:text-accent-400"
          >
            Sign in
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
            <>
              <PasswordInput
                {...props}
                // The rules below stand in for the hint the field would
                // otherwise carry, so they are what describes the input.
                aria-describedby={cn(props['aria-describedby'], rulesId)}
                name="password"
                value={password}
                autoComplete="new-password"
                onChange={(event) => handleChange('password', event.target.value, setPassword)}
                onBlur={() => handleBlur('password', password)}
              />

              <ul id={rulesId} className="flex flex-wrap gap-x-4 gap-y-1">
                {rules.map((rule) => (
                  <li
                    key={rule.label}
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      rule.met
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-stone-500 dark:text-stone-400',
                    )}
                  >
                    {/* Solid tick against hollow circle, so the state is
                        readable without relying on the colour. */}
                    {rule.met ? (
                      <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      <span className="sr-only">{rule.met ? 'Met: ' : 'Not met: '}</span>
                      {rule.label}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Field>

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          Pact Pulse provides automated analysis, not legal advice.
        </p>
      </form>
    </AuthLayout>
  )
}
