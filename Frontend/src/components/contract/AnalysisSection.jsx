import { useEffect, useMemo, useState } from 'react'
import { Play, RefreshCw } from 'lucide-react'

import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Card, CardBody, CardHeader } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Skeleton } from '../ui/Skeleton'
import { Spinner } from '../ui/Spinner'
import { ReportView } from '../ReportView'
import { formatDateTime, formatDuration } from '../../lib/format'

/** Elapsed seconds since `startedAt`, ticking while `active`. */
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
    return Number.isNaN(started) ? null : Math.max(0, (now - started) / 1000)
  }, [active, startedAt, now])
}

/**
 * The analysis region: one of five states - error, loading, running, failed,
 * finished - or the "not analyzed yet" prompt.
 */
export function AnalysisSection({
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
  onLocate,
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
            {analysis?.error || 'Something went wrong. Please try again.'}
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
          onLocate={onLocate}
        />
      </div>
    )
  }

  return (
    <Card>
      <EmptyState
        icon={Play}
        title="This contract has not been analyzed"
        description="The analysis reads the contract and reports risky clauses, a clause checklist, key terms and obligations. It runs in the background and usually takes under a minute."
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
      <CardHeader title="Analyzing" description="You can leave this page. The analysis keeps going and will be here when you come back." />
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3 text-sm" role="status" aria-live="polite">
          <Spinner />
          <span>Working{elapsed != null ? ` · ${formatDuration(elapsed)} elapsed` : ''}</span>
        </div>

        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>

        {timedOut ? (
          <Alert tone="warning" title="This is taking longer than usual">
            Refresh to check on it, or start the analysis again.
          </Alert>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Long contracts are analysed in several parts, which takes longer. You can already ask
            questions in the chat while you wait.
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
