import { useId, useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'

import { cn } from '../lib/cn'
import { ALLOWED_EXTENSIONS_LABEL, MAX_FILE_SIZE_LABEL } from '../lib/constants'

/**
 * Drag-and-drop plus a file picker. The whole area is a <label> for a hidden
 * input, so it is clickable, keyboard focusable and announced correctly without
 * any JavaScript.
 */
export function FileDropzone({ onSelect, disabled = false, invalid = false, className }) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = (fileList) => {
    const file = fileList?.[0]
    if (file) onSelect?.(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    if (disabled) return
    handleFiles(event.dataTransfer?.files)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.txt"
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files)
          // Reset so choosing the same file twice in a row still fires.
          event.target.value = ''
        }}
      />

      <label
        htmlFor={inputId}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        aria-disabled={disabled || undefined}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
          isDragging
            ? 'border-accent-600 bg-accent-50 dark:border-accent-500 dark:bg-accent-950/40'
            : 'border-stone-300 bg-white hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800/60',
          invalid && 'border-red-400 dark:border-red-800',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400">
          <UploadCloud className="h-5 w-5" aria-hidden="true" />
        </div>

        <p className="mt-4 text-sm font-medium">
          Drop a contract here, or{' '}
          <span className="text-accent-700 underline underline-offset-2 dark:text-accent-400">
            choose a file
          </span>
        </p>

        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          {ALLOWED_EXTENSIONS_LABEL} &middot; up to {MAX_FILE_SIZE_LABEL}
        </p>
      </label>
    </div>
  )
}
