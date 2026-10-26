// Trailing slashes are stripped so path concatenation stays predictable.
//
// The default host is "localhost", not "127.0.0.1", and that matters. The
// refresh cookie is set SameSite=Lax, and browsers treat 127.0.0.1 and
// localhost as different sites: a page served from localhost:5173 calling
// 127.0.0.1:8000 is a cross-site request, so the browser withholds the cookie
// and every session silently fails to restore. Same host with a different port
// is same-site, which is what makes the refresh flow work in development.
// In production the API is served from the same origin as the app, so the
// build sets VITE_API_URL to an empty string and requests use relative paths.
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
).replace(/\/+$/, '')

export const THEME_STORAGE_KEY = 'pactpulse.theme'

// Mirrors Backend/app/models/user.py. The backend refuses anything outside this
// range with a 422, so the form checks first and says the same thing.
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128

// Mirrors Backend/app/config.py. The backend exposes no config endpoint, so
// these are duplicated here; if the limits change server-side, change them here
// too. The server is still the authority - these only give faster feedback.
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt']
export const ALLOWED_EXTENSIONS_LABEL = 'PDF, DOCX or TXT'
export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MAX_FILE_SIZE_LABEL = '10 MB'

export const PAGE_SIZE = 10

// Chat: how often to check whether a document has finished indexing.
export const CHAT_INDEX_POLL_MS = 2000

// Poll cadence for an in-flight analysis. The server marks a job stale after
// 10 minutes, so there is no point polling past that. Polling also pauses while
// the tab is hidden - see useAnalysis.
export const POLL_INTERVAL_MS = 3000
export const POLL_TIMEOUT_MS = 10 * 60 * 1000

export const CONTRACT_STATUS = {
  UPLOADED: 'uploaded',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  FAILED: 'failed',
}

export const CONTRACT_STATUS_META = {
  uploaded: { label: 'Uploaded' },
  analyzing: { label: 'Analyzing' },
  analyzed: { label: 'Analyzed' },
  failed: { label: 'Failed' },
}

export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'analyzing', label: 'Analyzing' },
  { value: 'analyzed', label: 'Analyzed' },
  { value: 'failed', label: 'Failed' },
]

// The fixed clause checklist every report answers. Order and keys mirror
// ClauseChecklist in Backend/app/models/report.py.
export const CHECKLIST_ITEMS = [
  { key: 'liability_cap', label: 'Limit on liability' },
  { key: 'indemnity', label: 'Covering the other side’s losses (indemnity)' },
  { key: 'termination', label: 'Ending the contract' },
  { key: 'auto_renewal', label: 'Automatic renewal' },
  { key: 'payment_terms', label: 'Payment, penalties and late fees' },
  { key: 'non_compete', label: 'Non-compete / non-solicit' },
  { key: 'confidentiality', label: 'Confidentiality' },
  { key: 'ip_ownership', label: 'Who owns the work (IP)' },
  { key: 'assignment', label: 'Transferring the contract' },
  { key: 'unilateral_changes', label: 'One-sided changes to terms' },
  { key: 'dispute_resolution', label: 'Disputes, courts and governing law' },
  { key: 'personal_guarantee', label: 'Personal guarantee' },
]

export const CHECK_STATUS_META = {
  needs_attention: { label: 'Needs attention', rank: 0 },
  missing: { label: 'Not covered', rank: 1 },
  fine: { label: 'Looks fine', rank: 2 },
  not_applicable: { label: 'Not relevant', rank: 3 },
}
