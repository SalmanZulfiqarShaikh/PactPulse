import { API_BASE_URL } from '../lib/constants'

/**
 * A failed request. `status` is 0 for a transport-level failure, and `isAuth`
 * marks a 401/403 - the caller has no valid session.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, detail = null, isNetwork = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.isNetwork = isNetwork
    this.isAuth = status === 401 || status === 403
  }
}

const OFFLINE_MESSAGE =
  'We couldn’t connect. Check your internet connection and try again.'

// --- Session -----------------------------------------------------------------
//
// The access token lives in this module variable and nowhere else. It is never
// written to localStorage or sessionStorage: a reload always takes a fresh one
// from the httpOnly refresh cookie, and an injected script cannot read a stored
// credential. Nothing in this file logs it.

let accessToken = null

// One shared in-flight refresh. Without this, a page that fires five requests
// at once with an expired token would start five refreshes; because the server
// rotates the cookie, four of them would be working from a cookie the first one
// has already replaced.
let refreshPromise = null

// Called when a protected request cannot be recovered. AuthContext uses it to
// drop the user; it must not call back into the API.
let sessionExpiredHandler = null

export function setAccessToken(token) {
  accessToken = token || null
}

export function getAccessToken() {
  return accessToken
}

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler
}

function expireSession() {
  accessToken = null
  sessionExpiredHandler?.()
}

/**
 * FastAPI returns `detail` as a string for raised HTTPExceptions, but as a list
 * of objects for 422 validation errors. Normalise both into one readable line.
 */
function extractDetail(payload) {
  if (!payload || typeof payload !== 'object') return null

  if (typeof payload.detail === 'string') return payload.detail

  if (Array.isArray(payload.detail)) {
    return payload.detail
      .map((item) => {
        if (!item || typeof item !== 'object') return String(item)
        // loc[0] is always "body"/"query"/"path", which adds nothing for a user.
        const field = Array.isArray(item.loc) ? item.loc.slice(1).join('.') : ''
        return field ? `${field}: ${item.msg}` : item.msg
      })
      .join('; ')
  }

  return null
}

/**
 * The server's own `detail` always wins - it is written for a person. These are
 * only the fallbacks for a response that carries no message.
 */
function messageForStatus(status, detail) {
  if (detail) return detail

  switch (status) {
    case 400:
    case 422:
      return 'Something about that didn’t look right. Check it and try again.'
    case 401:
      return 'Your session has ended. Please sign in again.'
    case 403:
      return 'You don’t have access to that.'
    case 404:
      return 'We couldn’t find that. It may have been deleted.'
    case 409:
      return 'That’s already in progress.'
    case 413:
      return 'That file is too large.'
    case 429:
      return 'Too many attempts. Please wait a minute and try again.'
    case 502:
    case 503:
    case 504:
      return 'We’re having trouble right now. Please try again in a few minutes.'
    default:
      return 'Something went wrong on our side. Please try again in a moment.'
  }
}

function parseJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function abortError() {
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

/** One request, no retry logic. Everything else is built on this. */
async function rawRequest(path, { method = 'GET', body, signal, auth = true, form } = {}) {
  const headers = {}

  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`

  let payload
  if (form !== undefined) {
    // Let the browser set Content-Type, so the multipart boundary is right.
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: payload,
      signal,
      // Required for the httpOnly refresh cookie to travel with /auth/* calls.
      credentials: 'include',
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError(OFFLINE_MESSAGE, { isNetwork: true })
  }

  if (response.status === 204) return null

  const text = await response.text()
  const data = parseJson(text)

  if (!response.ok) {
    const detail = extractDetail(data)
    throw new ApiError(messageForStatus(response.status, detail), {
      status: response.status,
      detail,
    })
  }

  return data
}

/**
 * Exchange the refresh cookie for a new access token.
 *
 * Concurrent callers share one request, so N simultaneous 401s cause exactly
 * one refresh. A failure clears the token: the session is over, and the caller
 * decides whether to show a login screen.
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = rawRequest('/auth/refresh', { method: 'POST', auth: false })
      .then((data) => {
        accessToken = data?.access_token ?? null
        return data
      })
      .catch((error) => {
        accessToken = null
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

/**
 * A request that recovers from one expired access token.
 *
 * `auth: false` marks the calls where a 401 is an answer rather than an expiry
 * - login with a wrong password is a 401, and refreshing on it would be wrong.
 * Everything else gets exactly one silent refresh and one replay, which is what
 * makes a 20-minute access token invisible to someone with the tab open.
 */
async function request(path, { auth = true, retried = false, ...options } = {}) {
  try {
    return await rawRequest(path, { ...options, auth })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    if (!auth || error?.status !== 401) throw error

    if (retried) {
      // The replay was rejected too, so the session really is gone.
      expireSession()
      throw error
    }

    try {
      await refreshSession()
    } catch {
      expireSession()
      throw error
    }

    return request(path, { ...options, auth, retried: true })
  }
}

/**
 * Upload a single file. Uses XMLHttpRequest rather than fetch because fetch
 * cannot report upload progress.
 */
function uploadOnce(file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    // The backend expects the field to be named exactly "file".
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/contracts/upload`)
    xhr.withCredentials = true

    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)

    if (signal) {
      if (signal.aborted) {
        reject(abortError())
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      const data = parseJson(xhr.responseText)

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve(data)
        return
      }

      const detail = extractDetail(data)
      reject(new ApiError(messageForStatus(xhr.status, detail), { status: xhr.status, detail }))
    }

    xhr.onerror = () => reject(new ApiError(OFFLINE_MESSAGE, { isNetwork: true }))
    xhr.onabort = () => reject(abortError())

    xhr.send(form)
  })
}

export async function uploadContract(file, { onProgress, signal } = {}) {
  try {
    return await uploadOnce(file, { onProgress, signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    if (error?.status !== 401) throw error

    // An upload can outlive its access token on a slow connection, so it gets
    // the same single refresh-and-retry treatment as everything else. Progress
    // restarts from zero, which the caller already renders.
    try {
      await refreshSession()
    } catch {
      expireSession()
      throw error
    }

    try {
      return await uploadOnce(file, { onProgress, signal })
    } catch (retryError) {
      if (retryError?.status === 401) expireSession()
      throw retryError
    }
  }
}

const enc = (value) => encodeURIComponent(value)

export const api = {
  /** Backend liveness check. Open. Throws if the API is unreachable. */
  health: (signal) => request('/health', { auth: false, signal }),

  // --- Auth. None of these attach a token, and none trigger a refresh. ---
  register: ({ email, password }) =>
    request('/auth/register', { method: 'POST', auth: false, body: { email, password } }),
  /** Confirms the emailed 6-digit code. Signs in on success, like login. */
  verifyEmail: ({ email, code }) =>
    request('/auth/verify', { method: 'POST', auth: false, body: { email, code } }),
  resendCode: (email) =>
    request('/auth/resend-code', { method: 'POST', auth: false, body: { email } }),
  login: ({ email, password }) =>
    request('/auth/login', { method: 'POST', auth: false, body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST', auth: false }),
  me: (signal) => request('/auth/me', { signal }),
  refresh: () => refreshSession(),

  listContracts: ({ search, status, limit, skip } = {}, signal) => {
    const query = new URLSearchParams()
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    if (limit != null) query.set('limit', String(limit))
    if (skip != null) query.set('skip', String(skip))

    const suffix = query.toString()
    return request(`/contracts${suffix ? `?${suffix}` : ''}`, { signal })
  },

  /** Full contract including extracted text. */
  getContract: (contractId, signal) => request(`/contracts/${enc(contractId)}`, { signal }),

  /** Metadata and a text preview, lighter than the full document. */
  getSummary: (contractId, signal) =>
    request(`/contracts/${enc(contractId)}/summary`, { signal }),

  /** Irreversible: the contract, its analysis and the stored file all go. */
  deleteContract: (contractId) =>
    request(`/contracts/${enc(contractId)}`, { method: 'DELETE' }),

  /** Starts a background job and returns 202. */
  analyze: (contractId) => request(`/analysis/analyze/${enc(contractId)}`, { method: 'POST' }),

  /** Analysis status and report. 404 means no analysis has ever been started. */
  getInsights: (contractId, signal) => request(`/analysis/${enc(contractId)}/insights`, { signal }),

  // --- Document chat ---
  /** The conversation so far, plus whether the document is ready for chat. */
  getChat: (contractId, signal) => request(`/contracts/${enc(contractId)}/chat`, { signal }),

  /** Ask a question. Resolves with { question, answer }; answers cite passages as [P#]. */
  sendChat: (contractId, message, signal) =>
    request(`/contracts/${enc(contractId)}/chat`, { method: 'POST', body: { message }, signal }),

  clearChat: (contractId) => request(`/contracts/${enc(contractId)}/chat`, { method: 'DELETE' }),

  /** Rebuild the document's search index, e.g. after it failed. */
  reindexChat: (contractId) =>
    request(`/contracts/${enc(contractId)}/chat/reindex`, { method: 'POST' }),

  uploadContract,
}

export { API_BASE_URL }
