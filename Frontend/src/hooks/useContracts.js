import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api/client'
import { PAGE_SIZE } from '../lib/constants'

/**
 * The dashboard list. `total` is the server's count of *all* matches, so paging
 * stays correct once results are filtered.
 */
export function useContracts({ search = '', status = '', page = 1, pollWhileAnalyzing = false } = {}) {
  const [contracts, setContracts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const abortRef = useRef(null)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const skip = useMemo(() => Math.max(0, (page - 1) * PAGE_SIZE), [page])

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller

    // Keep the previous rows visible while a new page loads, so paging and
    // typing in the search box do not blank the table.
    setLoading(true)

    api
      .listContracts(
        { search: search || undefined, status: status || undefined, limit: PAGE_SIZE, skip },
        controller.signal,
      )
      .then((data) => {
        if (controller.signal.aborted) return
        setContracts(data?.contracts ?? [])
        setTotal(data?.total ?? data?.count ?? 0)
        setError(null)
      })
      .catch((requestError) => {
        if (requestError?.name === 'AbortError') return
        setError(requestError)
        setContracts([])
        setTotal(0)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [search, status, skip, reloadToken])

  // A cheap refresh while anything on the page is still being analyzed, so the
  // status column settles on its own without a manual reload.
  useEffect(() => {
    if (!pollWhileAnalyzing) return undefined
    if (!contracts.some((contract) => contract.status === 'analyzing')) return undefined

    const timer = setTimeout(reload, 4000)
    return () => clearTimeout(timer)
  }, [pollWhileAnalyzing, contracts, reload])

  /** Drop a row locally so the UI updates before the refetch lands. */
  const removeLocally = useCallback((contractId) => {
    setContracts((current) => current.filter((contract) => contract.contract_id !== contractId))
    setTotal((current) => Math.max(0, current - 1))
  }, [])

  return { contracts, total, loading, error, reload, removeLocally }
}
