import {
  ALLOWED_EXTENSIONS,
  ALLOWED_EXTENSIONS_LABEL,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
} from './constants'

/**
 * Client-side pre-flight for an upload.
 *
 * The server enforces both rules again - this only exists so an obviously
 * wrong file is rejected before we spend time on the transfer. Returns an
 * error string, or null when the file looks acceptable.
 */
export function validateFile(file) {
  if (!file) return 'Choose a file to upload.'

  const name = file.name || ''
  const dot = name.lastIndexOf('.')
  const extension = dot === -1 ? '' : name.slice(dot).toLowerCase()

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Unsupported file type "${extension || name}". Use ${ALLOWED_EXTENSIONS_LABEL}.`
  }

  if (file.size === 0) return 'That file is empty.'

  if (file.size > MAX_FILE_SIZE) {
    return `That file is larger than ${MAX_FILE_SIZE_LABEL}.`
  }

  return null
}
