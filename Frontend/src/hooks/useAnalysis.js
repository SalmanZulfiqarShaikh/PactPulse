import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api/client'
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from '../lib/constants'

/**
 * Analysis state for one contract, including the polling loop.
 *
 * The insights endpoint answers 404 until an analysis has ever been started,
 * which is a normal "not analysed yet" state rather than a failure, so it is
 * mapped to `status: 'not_started'` instead of surfacing as an error.
 */
export function useAnalysis(contractId) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(Boolean(contractId))
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)
  const [timedOut, setTimedOut] = useState(false)

  const abortRef = useRef(null)

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!contractId) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (!silent) setLoading(true)

      try {
        const data = await api.getInsights(contractId, controller.signal)
        if (controller.signal.aborted) return
        setAnalysis(data ?? null)
        setError(null)
      } catch (requestError) {
        if (requestError?.name === 'AbortError' || controller.signal.aborted) return

        if (requestError?.status === 404) {
          setAnalysis({ contract_id: contractId, status: 'not_started', insights: null })
          setError(null)
        } else {
          setError(requestError)
        }
      } finally {
        if (!controller.signal.aborted && !silent) setLoading(false)
      }
    },
    [contractId],
  )

  useEffect(() => {
    setAnalysis(null)
    setError(null)
    setTimedOut(false)
    refresh()
    return () => abortRef.current?.abort()
  }, [refresh])

  const isAnalyzing = analysis?.status === 'analyzing'

  // Poll only while the server says a job is running. Any status change ends
  // the loop on its own, because the effect depends on the status.
  useEffect(() => {
    if (!isAnalyzing) return undefined

    let cancelled = false
    let timer = null
    const deadline = Date.now() + POLL_TIMEOUT_MS

    const tick = async () => {
      if (cancelled) return
      if (Date.now() > deadline) {
        // The server marks a job stale after ten minutes and reports it as
        // failed, so polling past that point achieves nothing.
        setTimedOut(true)
        return
      }

      // Nothing is on screen to update while the tab is in the background, so
      // skip the request and stay scheduled. The listener below catches up the
      // moment the reader comes back.
      if (document.visibilityState === 'visible') {
        await refresh({ silent: true })
      }

      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh({ silent: true })
    }

    document.addEventListener('visibilitychange', handleVisibility)
    timer = setTimeout(tick, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isAnalyzing, refresh])

  const start = useCallback(async () => {
    setStarting(true)
    setStartError(null)
    setTimedOut(false)

    try {
      await api.analyze(contractId)
    } catch (requestError) {
      if (requestError?.name === 'AbortError') {
        setStarting(false)
        return
      }
      // 409 means someone already started it, which is the outcome we wanted.
      if (requestError?.status !== 409) {
        setStartError(requestError)
        setStarting(false)
        return
      }
    }

    await refresh({ silent: true })
    setStarting(false)
  }, [contractId, refresh])

  return {
    analysis,
    status: analysis?.status ?? null,
    insights: analysis?.insights ?? null,
    loading,
    error,
    refresh,
    start,
    starting,
    startError,
    timedOut,
  }
}
