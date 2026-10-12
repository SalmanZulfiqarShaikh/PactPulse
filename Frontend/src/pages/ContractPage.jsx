import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Play,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { PageContainer } from '../components/layout/AppShell'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Spinner } from '../components/ui/Spinner'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/ErrorState'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import { ReportView, DISCLAIMER } from '../components/ReportView'
import { DeleteContractDialog } from '../components/DeleteContractDialog'
import { api } from '../api/client'
import { useAnalysis } from '../hooks/useAnalysis'
import { formatBytes, formatCount, formatDateTime, formatDuration } from '../lib/format'
import { cn } from '../lib/cn'

function MetaItem({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}

/** Elapsed time since the job started, ticking while it runs. */
function useElapsed(startedAt, active) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])

  return useMemo(() => {
    if (!active || !startedAt) return null
    const started = new Date(startedAt).getTime()
    if (Number.isNaN(started)) return null
    return Math.max(0, (now - started) / 1000)
  }, [active, startedAt, now])
}

/** The analysis region: one of five mutually exclusive states. */
function AnalysisSection({
  analysis,
  status,
  loading,
  error,
  refresh,
  start,
  starting,
  startError,
  timedOut,
  contractTitle,
}) {
  if (error) {
    return <ErrorState error={error} onRetry={refresh} title="Could not load the analysis" />
  }

  if (loading && !analysis) {
    return (
      <Card>
        <CardHeader title="Analysis" />
        <CardBody className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardBody>
      </Card>
    )
  }

  if (status === 'analyzing') {
    return <AnalyzingPanel startedAt={analysis?.started_at} timedOut={timedOut} onRefresh={refresh} />
  }

  if (status === 'failed') {
    return (
      <Card>
        <CardHeader title="Analysis failed" />
        <CardBody className="space-y-4">
          <Alert tone="danger" title="The analysis did not complete">
            {analysis?.error || 'The server did not report a reason.'}
          </Alert>

          {startError && <Alert tone="danger">{startError.message}</Alert>}

          <Button onClick={start} loading={starting}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try the analysis again
          </Button>
        </CardBody>
      </Card>
    )
  }

  if (status === 'analyzed' && analysis?.insights) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Analysis report</h2>
            <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">
              Completed {formatDateTime(analysis.completed_at)}
              {analysis.model ? ` · ${analysis.model}` : ''}
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={start} loading={starting}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Run again
          </Button>
        </div>

        {startError && <Alert tone="danger">{startError.message}</Alert>}

        <ReportView
          insights={analysis.insights}
          contractTitle={contractTitle}
          onReanalyze={start}
          reanalyzing={starting}
        />
      </div>
    )
  }

  return (
    <Card>
      <EmptyState
        icon={Play}
        title="This contract has not been analyzed"
        description="The analysis reads the contract and reports risky clauses, key terms and obligations. It runs in the background and usually takes under a minute."
        action={
          <Button onClick={start} loading={starting} disabled={starting}>
            Analyze contract
          </Button>
        }
      />
    </Card>
  )
}

function AnalyzingPanel({ startedAt, timedOut, onRefresh }) {
  const elapsed = useElapsed(startedAt, true)

  return (
    <Card>
      <CardHeader title="Analyzing" description="This runs on the server. You can leave this page open." />

      <CardBody className="space-y-4">
        <div className="flex items-center gap-3 text-sm" role="status" aria-live="polite">
          <Spinner />
          <span>
            Working{elapsed != null ? ` · ${formatDuration(elapsed)} elapsed` : ''}
          </span>
        </div>

        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>

        {timedOut ? (
          <Alert tone="warning" title="Still running after ten minutes">
            The server treats a job this old as stalled. Refresh to see the current state, or start
            it again.
          </Alert>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Long contracts are analysed in several parts, which takes longer.
          </p>
        )}

        <Button variant="secondary" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Check now
        </Button>
      </CardBody>
    </Card>
  )
}

export function ContractPage() {
  const { contractId } = useParams()
  const navigate = useNavigate()

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(null)
  const [summaryToken, setSummaryToken] = useState(0)

  const [fullContract, setFullContract] = useState(null)
  const [fullLoading, setFullLoading] = useState(false)
  const [fullError, setFullError] = useState(null)
  const [textOpen, setTextOpen] = useState(false)

  const [pendingDelete, setPendingDelete] = useState(false)

  const abortRef = useRef(null)

  const analysis = useAnalysis(contractId)
  const { refresh: refreshAnalysis } = analysis

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller

    setSummaryLoading(true)
    setFullContract(null)
    setFullError(null)
    setTextOpen(false)

    api
      .getSummary(contractId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setSummary(data)
        setSummaryError(null)
      })
      .catch((requestError) => {
        if (requestError?.name === 'AbortError' || controller.signal.aborted) return
        setSummaryError(requestError)
      })
      .finally(() => {
        if (!controller.signal.aborted) setSummaryLoading(false)
      })

    return () => controller.abort()
  }, [contractId, summaryToken])

  // The full text is only fetched once the reader asks for it: the summary
  // endpoint already carries the opening of the document, so the extra request
  // is skipped until it is actually wanted.
  const loadFullText = useCallback(async () => {
    setTextOpen(true)
    if (fullContract || fullLoading) return

    setFullLoading(true)
    try {
      const data = await api.getContract(contractId)
      setFullContract(data)
      setFullError(null)
    } catch (requestError) {
      setFullError(requestError)
    } finally {
      setFullLoading(false)
    }
  }, [contractId, fullContract, fullLoading])

  const retrySummary = () => setSummaryToken((token) => token + 1)

  const handleRefreshAll = () => {
    retrySummary()
    refreshAnalysis()
  }

  const title = summary?.originalname || fullContract?.originalname || contractId

  // After an analysis starts, the contract's own status flips server-side; the
  // effective status is whichever of the two is furthest along.
  const effectiveStatus = analysis.status && analysis.status !== 'not_started'
    ? analysis.status
    : summary?.analysis_status || 'not_started'

  if (summaryError) {
    return (
      <PageContainer>
        <BackLink />
        <div className="mt-4">
          <ErrorState
            error={summaryError}
            onRetry={retrySummary}
            title="Could not load this contract"
          />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <BackLink />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {summaryLoading && !summary ? (
            <Skeleton className="h-6 w-64" />
          ) : (
            <h1 className="break-words text-xl font-semibold tracking-tight">{title}</h1>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={effectiveStatus} />
            {summary && (
              <span className="text-xs text-stone-500 dark:text-stone-400">
                Uploaded {formatDateTime(summary.upload_date)}
              </span>
            )}
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            disabled={effectiveStatus !== 'analyzed'}
            title={
              effectiveStatus === 'analyzed'
                ? 'Print or save the report as PDF'
                : 'Available once the analysis has finished'
            }
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print report
          </Button>

          <Button variant="danger-ghost" size="sm" onClick={() => setPendingDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader title="Contract details" />
          <CardBody>
            {summaryLoading && !summary ? (
              <div className="grid gap-5 sm:grid-cols-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <dl className="grid gap-5 sm:grid-cols-3">
                <MetaItem label="Pages">{formatCount(summary?.page_count)}</MetaItem>
                <MetaItem label="Words">{formatCount(summary?.word_count)}</MetaItem>
                <MetaItem label="Size">{formatBytes(summary?.size_bytes)}</MetaItem>
                <MetaItem label="Uploaded">{formatDateTime(summary?.upload_date)}</MetaItem>
                <MetaItem label="Contract ID">
                  <code className="break-all text-xs">{contractId}</code>
                </MetaItem>
              </dl>
            )}
          </CardBody>
        </Card>

        <AnalysisSection {...analysis} contractTitle={title} />

        <Card>
          <CardHeader
            title="Contract text"
            description="The text as it was extracted at upload, exactly as the analysis read it."
            action={
              <button
                type="button"
                onClick={textOpen ? () => setTextOpen(false) : loadFullText}
                aria-expanded={textOpen}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300"
              >
                {textOpen ? 'Hide' : 'Show text'}
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', textOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
            }
          />

          {textOpen && (
            <CardBody className="space-y-3">
              {fullLoading && (
                <>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Loading the full text…
                  </p>
                  <div className="space-y-2" aria-hidden="true">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-4/6" />
                  </div>
                </>
              )}

              {fullError && (
                <>
                  <Alert tone="danger" title="Could not load the full text">
                    {fullError.message}
                  </Alert>

                  {/* The summary already carries the opening of the document, so
                      there is still something to read when the big fetch fails. */}
                  {summary?.preview && (
                    <div className="preserve-whitespace rounded-md border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-800 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200">
                      {summary.preview}
                      {summary.preview_truncated && (
                        <span className="text-stone-500 dark:text-stone-400">{'\n\n…'}</span>
                      )}
                    </div>
                  )}
                </>
              )}

              {!fullLoading && !fullError && fullContract && (
                <>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {formatCount(fullContract.word_count)} words ·{' '}
                    {formatCount((fullContract.text_content || '').length)} characters
                  </p>
                  <div className="preserve-whitespace max-h-[32rem] overflow-y-auto rounded-md border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-800 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200">
                    {fullContract.text_content || 'No text was extracted from this document.'}
                  </div>
                </>
              )}
            </CardBody>
          )}

          {!textOpen && (
            <CardBody>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Hidden by default. Use “Show text” to read what was extracted.
              </p>
            </CardBody>
          )}
        </Card>

        <p className="flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {DISCLAIMER}
        </p>
      </div>

      <DeleteContractDialog
        contract={pendingDelete ? { contract_id: contractId, originalname: title } : null}
        onClose={() => setPendingDelete(false)}
        onDeleted={() => {
          setPendingDelete(false)
          // The record is gone, so send the reader back to the list rather than
          // leaving them on a page that can no longer load.
          navigate('/app', { replace: true })
        }}
      />
    </PageContainer>
  )
}

function BackLink() {
  return (
    <Link
      to="/app"
      className="no-print inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All contracts
    </Link>
  )
}
