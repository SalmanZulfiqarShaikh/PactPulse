import { useId, useState } from 'react'
import { ChevronDown, LocateFixed } from 'lucide-react'

import { SeverityBadge } from './SeverityBadge'
import { QuoteCheckBadge } from './report/QuoteCheckBadge'
import { cn } from '../lib/cn'

/**
 * One flagged clause.
 *
 * The order inside the card is the order someone reads in: what the clause
 * says in plain words, what to do about it, and only then the verbatim text and
 * the legal reasoning. The quotation is kept last and collapsed because it is
 * the most intimidating thing on the card, and it is the least useful until the
 * reader already knows why they are looking at it.
 *
 * Collapsed by default so a long report stays scannable. Pass `open` and
 * `onToggle` to drive it from the parent (the report needs an expand-all
 * control); leave them off and it manages itself.
 */
export function RiskCard({ risk, open: controlledOpen, onToggle, defaultOpen = false, onLocate }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const regionId = useId()

  const open = controlledOpen ?? uncontrolledOpen
  const toggle = () => (onToggle ? onToggle() : setUncontrolledOpen((value) => !value))

  return (
    <div className="rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <h3>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={regionId}
          className="flex w-full items-start gap-3 rounded-lg px-4 py-3.5 text-left transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:hover:bg-stone-800/50"
        >
          <ChevronDown
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0 text-stone-500 transition-transform dark:text-stone-400',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />

          <span className="min-w-0 flex-1">
            <span className="block text-base font-medium">{risk.title || 'Untitled finding'}</span>
            <span className="mt-2 flex flex-wrap gap-2">
              <SeverityBadge severity={risk.severity} />
              <QuoteCheckBadge check={risk.quoteCheck} />
            </span>
          </span>
        </button>
      </h3>

      {open && (
        <div
          id={regionId}
          className="animate-fade-in space-y-4 border-t border-stone-200 px-4 py-4 motion-reduce:animate-none dark:border-stone-800"
        >
          {risk.plainExplanation && (
            <p className="max-w-prose text-base leading-relaxed text-stone-700 dark:text-stone-300">
              {risk.plainExplanation}
            </p>
          )}

          {risk.whatToDo && (
            <section className="rounded-md border-l-2 border-accent-700 bg-accent-50/60 px-3.5 py-3 dark:border-accent-500 dark:bg-accent-950/30">
              <h4 className="text-xs font-semibold tracking-wide text-accent-800 uppercase dark:text-accent-300">
                What to do
              </h4>
              <p className="mt-1.5 max-w-prose text-base leading-relaxed text-stone-800 dark:text-stone-200">
                {risk.whatToDo}
              </p>
            </section>
          )}

          {canLocate(risk) && onLocate && (
            <button
              type="button"
              onClick={() => onLocate(risk.quoteCheck)}
              className="no-print inline-flex items-center gap-1.5 rounded text-sm font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300"
            >
              <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
              Show in document
            </button>
          )}

          {risk.clauseText && (
            <Disclosure label="Show exact wording">
              {/* Copied verbatim from the contract, so whitespace is preserved. */}
              <blockquote className="preserve-whitespace max-h-72 overflow-y-auto rounded-md border-l-2 border-stone-300 bg-stone-50 px-3 py-2 text-sm leading-relaxed text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300">
                {risk.clauseText}
              </blockquote>
            </Disclosure>
          )}

          {risk.legalNote && (
            <Disclosure label="Legal detail">
              <p className="max-w-prose text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {risk.legalNote}
              </p>
            </Disclosure>
          )}
        </div>
      )}
    </div>
  )
}

function canLocate(risk) {
  return risk.quoteCheck?.start != null && risk.quoteCheck?.end != null
}

/**
 * A nested collapsible. Separate from the card's own disclosure so opening the
 * card does not dump a page of clause text on the reader.
 */
function Disclosure({ label, children }) {
  const [open, setOpen] = useState(false)
  const regionId = useId()

  return (
    <section className="border-t border-stone-200 pt-3 dark:border-stone-800">
      <h4>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={regionId}
          className="flex items-center gap-1.5 rounded text-xs font-semibold tracking-wide text-stone-600 uppercase transition-colors hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-stone-400 dark:hover:text-stone-100"
        >
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
          {label}
        </button>
      </h4>

      {open && (
        <div id={regionId} className="mt-2 animate-fade-in motion-reduce:animate-none">
          {children}
        </div>
      )}
    </section>
  )
}
