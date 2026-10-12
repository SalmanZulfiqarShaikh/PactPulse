import { useId, useState } from 'react'
import { Check, ChevronDown, Copy, ShieldCheck } from 'lucide-react'

import { RiskCard } from './RiskCard'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { Card, CardBody, CardHeader } from './ui/Card'
import { CountUp } from './ui/CountUp'
import { Modal } from './ui/Modal'
import { cn } from '../lib/cn'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  DISCLAIMER,
  displayDate,
  downloadText,
  groupObligationsByParty,
  normaliseReport,
  reportFilename,
  reportHeadline,
  reportToMarkdown,
  reportToPlainText,
  severityCounts,
} from '../lib/report'

function Empty({ children }) {
  return <p className="text-sm text-stone-500 dark:text-stone-400">{children}</p>
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase dark:text-stone-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm break-words">{children}</dd>
    </div>
  )
}

/**
 * The full report.
 *
 * Reading order is the point: the summary first, then what it means, then the
 * details, then the flagged clauses. Everything maps to a field the API
 * actually returns - an empty list says so rather than being padded out.
 */
export function ReportView({ insights, contractTitle = '', onReanalyze, reanalyzing = false }) {
  // Which finding cards are open. The first one is opened for the reader, so
  // the shape of a finding is obvious without a click.
  const [expanded, setExpanded] = useState(() => new Set([0]))
  const [confirmReanalyze, setConfirmReanalyze] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(null)

  const report = normaliseReport(insights)

  if (!report) return null

  const { risks } = report
  const counts = severityCounts(risks)
  const groups = groupObligationsByParty(report.obligations)
  const allExpanded = risks.length > 0 && expanded.size === risks.length
  const headline = reportHeadline(report)

  const toggleAll = () => {
    setExpanded(allExpanded ? new Set() : new Set(risks.map((_, index) => index)))
  }

  const toggleOne = (index) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportToPlainText(contractTitle, report))
      setCopied(true)
      setCopyError(null)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('This browser would not let the page copy. Use one of the download buttons.')
    }
  }

  const handleDownload = (extension) => {
    const markdown = extension === 'md'
    downloadText(
      reportFilename(contractTitle, extension),
      markdown ? reportToMarkdown(contractTitle, report) : reportToPlainText(contractTitle, report),
      markdown ? 'text/markdown' : 'text/plain',
    )
  }

  // Exporting runs entirely in the browser on what is already on screen.
  const exportActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={handleCopy}>
        {copied ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {copied ? 'Copied' : 'Copy summary'}
      </Button>

      <Button variant="secondary" size="sm" onClick={() => handleDownload('txt')}>
        Download .txt
      </Button>

      <Button variant="secondary" size="sm" onClick={() => handleDownload('md')}>
        Download .md
      </Button>
    </div>
  )

  return (
    <article className="space-y-6">
      {!report.isPlain && (
        <Alert
          tone="info"
          title="This report uses the older wording"
          action={
            onReanalyze ? (
              <Button size="sm" variant="secondary" onClick={() => setConfirmReanalyze(true)}>
                Re-analyze
              </Button>
            ) : null
          }
        >
          It was recorded before Pact Pulse switched to plain language, so some sections may read more
          technically. Re-analyzing produces a plain-language version.
        </Alert>
      )}

      {report.chunkCount > 1 && (
        <Alert tone="warning" title={`Analyzed in ${report.chunkCount} sections`}>
          This contract was too long to read in one pass, so it was split into {report.chunkCount}{' '}
          parts and the findings were combined. Detail can be lost at the joins - check any quotation
          against the original.
        </Alert>
      )}

      <Card>
        <CardHeader title="Summary" action={exportActions} />

        <CardBody className="space-y-5">
          {/* The one-line "what this is" before the detail, so the shape of the
              deal is clear before the summary starts. Built from the structured
              fields; when they are missing the report just starts below. */}
          {headline && (
            <div className="border-b border-stone-200 pb-5 dark:border-stone-800">
              <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
                In short
              </h3>
              <p className="mt-1.5 max-w-prose text-base leading-relaxed font-medium text-stone-800 dark:text-stone-200">
                {headline}
              </p>
            </div>
          )}

          {report.tldr ? (
            <p className="max-w-prose text-lg leading-relaxed text-stone-800 dark:text-stone-200">
              {report.tldr}
            </p>
          ) : (
            <Empty>No summary was returned for this contract.</Empty>
          )}

          {report.whatThisMeans.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
                What this means
              </h3>
              <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-5 text-base leading-relaxed text-stone-700 dark:text-stone-300">
                {report.whatThisMeans.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {copyError && <p className="text-sm text-red-700 dark:text-red-400">{copyError}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Contract type">{report.contractType || 'Not stated'}</Fact>

            <Fact label="Parties">
              {report.parties.length ? report.parties.join(', ') : 'Not stated'}
            </Fact>

            <Fact label="Effective date">{displayDate(report.effectiveDate)}</Fact>

            <Fact label="Governing law">{report.governingLaw || 'Not stated'}</Fact>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Risky clauses"
          description={
            risks.length ? (
              <>
                <CountUp value={risks.length} />{' '}
                {risks.length === 1 ? 'clause' : 'clauses'} flagged, most serious first.
              </>
            ) : (
              'Nothing was flagged in this contract.'
            )
          }
          action={
            risks.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <ul className="flex flex-wrap items-center gap-3">
                  {counts.map((entry) => (
                    <li
                      key={entry.severity}
                      className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${entry.dot}`} aria-hidden="true" />
                      <CountUp value={entry.count} /> {entry.label}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={toggleAll}
                  className="rounded text-xs font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-accent-400 dark:hover:text-accent-300"
                >
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              </div>
            ) : null
          }
        />

        <CardBody>
          {risks.length ? (
            <div className="space-y-3">
              {risks.map((risk, index) => (
                <RiskCard
                  key={`${risk.title}-${index}`}
                  risk={risk}
                  open={expanded.has(index)}
                  onToggle={() => toggleOne(index)}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />

              <div>
                <p className="text-sm font-medium">No risks identified</p>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                  The analysis did not flag anything in this contract. That is not a clean bill of
                  health - read the document yourself before relying on it.
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <CollapsibleSection
        title="Key terms"
        description="The commercial terms the contract turns on."
        count={report.keyTerms.length}
      >
        {report.keyTerms.length ? (
          <dl className="divide-y divide-stone-200 dark:divide-stone-800">
            {report.keyTerms.map((item, index) => (
              <div key={`${item.term}-${index}`} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium">{item.term}</dt>
                <dd className="text-sm leading-relaxed text-stone-700 sm:col-span-2 dark:text-stone-300">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <Empty>No key terms were extracted.</Empty>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Obligations"
        description="What each party has to do, as the contract states it."
        count={report.obligations.length}
      >
        {groups.length ? (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.party}>
                <h4 className="text-sm font-medium">{group.party}</h4>
                <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-5 text-base leading-relaxed text-stone-700 dark:text-stone-300">
                  {group.items.map((item, index) => (
                    <li key={`${item.obligation}-${index}`}>{item.obligation}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No obligations were extracted.</Empty>
        )}
      </CollapsibleSection>

      <p className="max-w-prose text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        {DISCLAIMER} The output is generated by a language model and can be wrong, incomplete, or
        quote the contract inaccurately. Read the source document before acting on anything here.
      </p>

      <Modal
        open={confirmReanalyze}
        onClose={() => setConfirmReanalyze(false)}
        title="Replace this report?"
        description="A new analysis overwrites the report on this contract. The current one cannot be brought back."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmReanalyze(false)}
              disabled={reanalyzing}
            >
              Cancel
            </Button>
            <Button
              loading={reanalyzing}
              onClick={() => {
                setConfirmReanalyze(false)
                onReanalyze?.()
              }}
            >
              Re-analyze
            </Button>
          </>
        }
      />
    </article>
  )
}

/**
 * A report section that folds away.
 *
 * It follows the viewport until the reader touches it: open where there is
 * room on the page, collapsed on a phone where the list would otherwise push
 * everything below it out of reach. After the first click the reader's own
 * choice wins, at any width.
 */
function CollapsibleSection({ title, description, count, children }) {
  const regionId = useId()
  const isWide = useMediaQuery('(min-width: 640px)')
  const [choice, setChoice] = useState(null)

  const open = choice ?? isWide

  return (
    <Card>
      <h2>
        <button
          type="button"
          onClick={() => setChoice(!open)}
          aria-expanded={open}
          aria-controls={regionId}
          className="flex w-full items-start justify-between gap-3 rounded-lg px-5 py-4 text-left transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:hover:bg-stone-800/50"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            {description && (
              <span className="mt-0.5 block text-sm text-stone-600 dark:text-stone-400">
                {description}
              </span>
            )}
          </span>

          <span className="flex shrink-0 items-center gap-2 pt-0.5">
            {count != null && (
              <span className="text-xs text-stone-500 tabular-nums dark:text-stone-400">
                {count}
              </span>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-stone-500 transition-transform dark:text-stone-400',
                open && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </span>
        </button>
      </h2>

      {open && (
        <div
          id={regionId}
          className="animate-fade-in border-t border-stone-200 px-5 py-4 motion-reduce:animate-none dark:border-stone-800"
        >
          {children}
        </div>
      )}
    </Card>
  )
}

export { DISCLAIMER }
