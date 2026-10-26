import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, MessageSquareText, Printer, RefreshCw, Trash2 } from 'lucide-react'

import { PageContainer } from '../components/layout/AppShell'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/ErrorState'
import { StatusBadge } from '../components/StatusBadge'
import { DISCLAIMER } from '../components/ReportView'
import { DeleteContractDialog } from '../components/DeleteContractDialog'
import { AnalysisSection } from '../components/contract/AnalysisSection'
import { DocumentText } from '../components/contract/DocumentText'
import { api } from '../api/client'
import { useAnalysis } from '../hooks/useAnalysis'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { formatBytes, formatCount, formatDateTime } from '../lib/format'

// The chat (and its Markdown renderer) loads only when a contract page opens.
const ChatPanel = lazy(() =>
  import('../components/chat/ChatPanel').then((module) => ({ default: module.ChatPanel })),
)

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

/** The summary endpoint: metadata and a preview, refetchable with `reload`. */
function useContractSummary(contractId) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    api
      .getSummary(contractId, controller.signal)
      .then((data) => {
        setSummary(data)
        setError(null)
      })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError') setError(requestError)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [contractId, token])

  return { summary, loading, error, reload: () => setToken((value) => value + 1) }
}

/** The full text, fetched only when the reader first asks for it. */
function useFullText(contractId) {
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setContract(null)
    setError(null)
  }, [contractId])

  const load = useCallback(async () => {
    if (contract || loading) return
    setLoading(true)
    try {
      setContract(await api.getContract(contractId))
      setError(null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoading(false)
    }
  }, [contractId, contract, loading])

  return { contract, loading, error, load }
}

export function ContractPage() {
  const { contractId } = useParams()
  const navigate = useNavigate()
  const isWide = useMediaQuery('(min-width: 1024px)')

  const { summary, loading: summaryLoading, error: summaryError, reload } = useContractSummary(contractId)
  const fullText = useFullText(contractId)
  const analysis = useAnalysis(contractId)

  const [textOpen, setTextOpen] = useState(false)
  const [highlight, setHighlight] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)

  useEffect(() => {
    setTextOpen(false)
    setHighlight(null)
  }, [contractId])

  const toggleText = () => {
    if (!textOpen) fullText.load()
    setTextOpen((open) => !open)
  }

  /** Open the document text and highlight a character range in it. */
  const locate = useCallback(
    (range) => {
      if (range?.start == null || range?.end == null) return
      fullText.load()
      setTextOpen(true)
      setHighlight({ start: range.start, end: range.end, key: Date.now() })
      setChatOpen(false)
    },
    [fullText],
  )

  const title = summary?.originalname || fullText.contract?.originalname || contractId
  const effectiveStatus =
    analysis.status && analysis.status !== 'not_started'
      ? analysis.status
      : summary?.analysis_status || 'not_started'

  if (summaryError) {
    return (
      <PageContainer>
        <BackLink />
        <div className="mt-4">
          <ErrorState error={summaryError} onRetry={reload} title="Could not load this contract" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="max-w-[92rem]">
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              reload()
              analysis.refresh()
            }}
          >
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

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="min-w-0 space-y-6">
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
                  <MetaItem label="Text source">
                    {summary?.text_source === 'ocr' ? 'Scanned (OCR)' : 'Digital text'}
                  </MetaItem>
                  <MetaItem label="Contract ID">
                    <code className="break-all text-xs">{contractId}</code>
                  </MetaItem>
                </dl>
              )}
            </CardBody>
          </Card>

          <AnalysisSection {...analysis} contractTitle={title} onLocate={locate} />

          <DocumentText
            open={textOpen}
            onToggle={toggleText}
            contract={fullText.contract}
            loading={fullText.loading}
            error={fullText.error}
            preview={summary?.preview}
            previewTruncated={summary?.preview_truncated}
            highlight={highlight}
            isScanned={summary?.text_source === 'ocr'}
          />

          <p className="flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {DISCLAIMER}
          </p>
        </div>

        {isWide && (
          <aside className="no-print">
            <div className="sticky top-20 h-[calc(100vh-7rem)]">
              <Suspense fallback={<Skeleton className="h-full w-full" />}>
                <ChatPanel contractId={contractId} onLocate={locate} className="h-full" />
              </Suspense>
            </div>
          </aside>
        )}
      </div>

      {!isWide && !chatOpen && (
        <Button
          className="no-print fixed bottom-24 right-4 z-30 shadow-lg md:bottom-6"
          onClick={() => setChatOpen(true)}
        >
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
          Ask the document
        </Button>
      )}

      {!isWide && chatOpen && (
        <div className="no-print fixed inset-0 z-50 bg-stone-950/40 p-2 sm:p-4">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <ChatPanel
              contractId={contractId}
              onLocate={locate}
              onClose={() => setChatOpen(false)}
              className="h-full"
            />
          </Suspense>
        </div>
      )}

      <DeleteContractDialog
        contract={pendingDelete ? { contract_id: contractId, originalname: title } : null}
        onClose={() => setPendingDelete(false)}
        onDeleted={() => {
          setPendingDelete(false)
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
