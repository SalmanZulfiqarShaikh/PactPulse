import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './constants'

// Deliberately permissive. The backend is the authority on what it accepts; this
// is here to catch an obvious typo before a round trip, not to police addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(value) {
  const email = String(value ?? '').trim()
  if (!email) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address, like name@firm.com.'
  return null
}

export function validatePassword(value) {
  const password = String(value ?? '')
  if (!password) return 'Enter your password.'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use no more than ${MAX_PASSWORD_LENGTH} characters.`
  }
  return null
}

/** Trimmed email, ready to send. */
export function normaliseEmail(value) {
  return String(value ?? '').trim()
}
