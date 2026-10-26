import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api/client'
import { CHAT_INDEX_POLL_MS } from '../lib/constants'

const PREPARING = new Set(['not_indexed', 'indexing'])

/**
 * The chat thread for one document.
 *
 * Right after upload the document is still being indexed, so the thread is
 * polled until it is ready. Sending is optimistic: the question appears at
 * once and is swapped for the stored copy when the answer arrives.
 */
export function useChat(contractId) {
  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const abortRef = useRef(null)

  const load = useCallback(
    async ({ silent = false } = {}) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      if (!silent) setLoading(true)

      try {
        const data = await api.getChat(contractId, controller.signal)
        if (controller.signal.aborted) return
        // Keep any optimistic message that is still waiting for its answer.
        setThread((current) => ({
          ...data,
          messages: [...data.messages, ...(current?.messages ?? []).filter((m) => m.pending)],
        }))
        setError(null)
      } catch (requestError) {
        if (requestError?.name !== 'AbortError' && !controller.signal.aborted) setError(requestError)
      } finally {
        if (!controller.signal.aborted && !silent) setLoading(false)
      }
    },
    [contractId],
  )

  useEffect(() => {
    setThread(null)
    load()
    return () => abortRef.current?.abort()
  }, [load])

  const indexStatus = thread?.index_status ?? null

  useEffect(() => {
    if (!PREPARING.has(indexStatus)) return undefined
    const timer = setInterval(() => load({ silent: true }), CHAT_INDEX_POLL_MS)
    return () => clearInterval(timer)
  }, [indexStatus, load])

  const send = useCallback(
    async (text) => {
      const message = text.trim()
      if (!message || sending) return false

      const pendingId = `pending-${Date.now()}`
      const optimistic = { message_id: pendingId, role: 'user', content: message, citations: [], pending: true }
      setThread((current) => ({ ...current, messages: [...(current?.messages ?? []), optimistic] }))
      setSending(true)
      setSendError(null)

      try {
        const reply = await api.sendChat(contractId, message)
        setThread((current) => ({
          ...current,
          messages: [
            ...current.messages.filter((m) => m.message_id !== pendingId),
            reply.question,
            reply.answer,
          ],
        }))
        return true
      } catch (requestError) {
        setThread((current) => ({
          ...current,
          messages: current.messages.filter((m) => m.message_id !== pendingId),
        }))
        setSendError(requestError)
        return false
      } finally {
        setSending(false)
      }
    },
    [contractId, sending],
  )

  const clear = useCallback(async () => {
    await api.clearChat(contractId)
    setThread((current) => ({ ...current, messages: [] }))
  }, [contractId])

  const reindex = useCallback(async () => {
    await api.reindexChat(contractId)
    setThread((current) => ({ ...current, index_status: 'indexing', index_error: null }))
  }, [contractId])

  return {
    messages: thread?.messages ?? [],
    indexStatus,
    indexError: thread?.index_error ?? null,
    loading,
    error,
    reload: load,
    send,
    sending,
    sendError,
    clear,
    reindex,
  }
}
