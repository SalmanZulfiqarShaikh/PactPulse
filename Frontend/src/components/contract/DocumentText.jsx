import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

import { Alert } from '../ui/Alert'
import { Card, CardBody, CardHeader } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { cn } from '../../lib/cn'
import { formatCount } from '../../lib/format'

const TEXT_BOX =
  'preserve-whitespace rounded-md border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-800 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200'

/**
 * The extracted document text, with an optional highlighted range.
 *
 * `highlight` is `{ start, end, key }` in character offsets - what the quote
 * check and chat citations return. A new `key` scrolls the range into view even
 * when the same range is chosen twice.
 */
export function DocumentText({
  open,
  onToggle,
  contract,
  loading,
  error,
  preview,
  previewTruncated,
  highlight,
  isScanned,
}) {
  return (
    <Card id="document-text">
      <CardHeader
        title="Document text"
        description={
          isScanned
            ? 'Read from a scanned PDF by OCR. Small transcription errors are possible.'
            : 'The text as it was extracted at upload, exactly as the analysis read it.'
        }
        action={
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300"
          >
            {open ? 'Hide' : 'Show text'}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
        }
      />

      <CardBody className="space-y-3">
        {!open && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Hidden by default. Use “Show text”, or “Show in document” on a finding or chat source.
          </p>
        )}

        {open && loading && (
          <div className="space-y-2" aria-label="Loading the full text">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        )}

        {open && error && (
          <>
            <Alert tone="danger" title="Could not load the full text">
              {error.message}
            </Alert>
            {preview && (
              <div className={TEXT_BOX}>
                {preview}
                {previewTruncated && <span className="text-stone-500">{'\n\n…'}</span>}
              </div>
            )}
          </>
        )}

        {open && !loading && !error && contract && (
          <>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {formatCount(contract.word_count)} words ·{' '}
              {formatCount((contract.text_content || '').length)} characters
            </p>
            <HighlightedText text={contract.text_content || ''} highlight={highlight} />
          </>
        )}
      </CardBody>
    </Card>
  )
}

function HighlightedText({ text, highlight }) {
  const markRef = useRef(null)
  const valid =
    highlight && highlight.start >= 0 && highlight.end > highlight.start && highlight.end <= text.length

  useEffect(() => {
    if (valid) markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [valid, highlight?.key])

  if (!text) return <div className={TEXT_BOX}>No text was extracted from this document.</div>

  return (
    <div className={cn(TEXT_BOX, 'max-h-[36rem] overflow-y-auto')}>
      {valid ? (
        <>
          {text.slice(0, highlight.start)}
          <mark
            ref={markRef}
            className="rounded-sm bg-amber-200 px-0.5 text-stone-900 dark:bg-amber-500/40 dark:text-stone-50"
          >
            {text.slice(highlight.start, highlight.end)}
          </mark>
          {text.slice(highlight.end)}
        </>
      ) : (
        text
      )}
    </div>
  )
}
