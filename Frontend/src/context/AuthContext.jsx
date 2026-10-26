import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { api, setAccessToken, setSessionExpiredHandler } from '../api/client'

const AuthContext = createContext(null)

/**
 * Who is signed in, and how to change that.
 *
 * The access token itself is not held here - it lives in the API client's
 * module scope, in memory only, and this provider never touches storage. What
 * React needs to know is only whether there is a session and who it belongs to.
 *
 * `status` is 'loading' until the initial refresh settles. Route guards wait for
 * 'ready' before deciding, otherwise a page reload would bounce a signed-in user
 * to the login screen for the split second before the cookie is exchanged.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  // A protected call that could not be recovered has already given up on the
  // session; drop the user so the guards take over.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null))
    return () => setSessionExpiredHandler(null)
  }, [])

  // Restore the session on load. The refresh cookie is httpOnly, so this is the
  // only way to find out whether a reload is still signed in.
  useEffect(() => {
    let cancelled = false

    api
      .refresh()
      .then((data) => {
        if (cancelled) return
        setUser({ user_id: data?.user_id ?? null, email: data?.email ?? '' })
      })
      .catch(() => {
        // No cookie, an expired one, or the backend is down. All the same here:
        // there is no session to restore, and this is not an error to show.
        if (cancelled) return
        setAccessToken(null)
        setUser(null)
      })
      .finally(() => {
        if (!cancelled) setStatus('ready')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const data = await api.login({ email, password })
    setAccessToken(data?.access_token ?? null)
    setUser({ user_id: data?.user_id ?? null, email: data?.email ?? email })
    return data
  }, [])

  // Registering does not sign in: the account starts unverified and a code is
  // emailed. verifyEmail completes it and signs in.
  const register = useCallback(({ email, password }) => api.register({ email, password }), [])

  const verifyEmail = useCallback(async ({ email, code }) => {
    const data = await api.verifyEmail({ email, code })
    setAccessToken(data?.access_token ?? null)
    setUser({ user_id: data?.user_id ?? null, email: data?.email ?? email })
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      // Tells the server to bump the account's session generation, which is what
      // stops the cookie minting new tokens. If it fails, the local session is
      // still dropped - leaving someone "signed in" against a dead server is
      // worse than a cookie that expires on its own.
      await api.logout()
    } catch {
      /* the local session goes regardless */
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, status, isAuthenticated: Boolean(user), login, register, verifyEmail, logout }),
    [user, status, login, register, verifyEmail, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
