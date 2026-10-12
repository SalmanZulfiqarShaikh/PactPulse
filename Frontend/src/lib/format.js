const DASH = '—'

/** Human-readable file size. */
export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return DASH

  const value = Number(bytes)
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB']
  let scaled = value / 1024
  let unit = 0

  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024
    unit += 1
  }

  return `${scaled < 10 ? scaled.toFixed(1) : Math.round(scaled)} ${units[unit]}`
}

/** ISO-8601 (UTC from the backend) to a local date and time. */
export function formatDateTime(iso) {
  if (!iso) return DASH
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return DASH

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** ISO-8601 to a local date, without the time. */
export function formatDate(iso) {
  if (!iso) return DASH
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return DASH

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Counts with thousands separators. */
export function formatCount(value) {
  if (value == null || Number.isNaN(Number(value))) return DASH
  return Number(value).toLocaleString()
}

/** "1 minute ago" style text for recent timestamps, falling back to a date. */
export function formatRelative(iso) {
  if (!iso) return DASH
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return DASH

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ago`

  return formatDate(iso)
}

/** Seconds as "1m 20s", for the analysis progress indicator. */
export function formatDuration(seconds) {
  if (seconds == null || seconds < 0) return DASH
  if (seconds < 60) return `${Math.floor(seconds)}s`

  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}m ${rest}s`
}

/** Long text shortened for a table cell, without cutting mid-word. */
export function truncate(text, max = 60) {
  const value = String(text ?? '')
  if (value.length <= max) return value

  const cut = value.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut}…`
}
