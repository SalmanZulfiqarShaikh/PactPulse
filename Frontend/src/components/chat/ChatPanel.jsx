import { useEffect, useRef, useState } from 'react'
import { MessageSquareText, RefreshCw, SendHorizontal, Trash2, X } from 'lucide-react'

import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { ChatMessage } from './ChatMessage'
import { useChat } from '../../hooks/useChat'
import { cn } from '../../lib/cn'

/**
 * "Ask the document": a chat grounded in this document only. Answers come from
 * an agent that searches the document and cites the passages it used; clicking
 * a citation highlights that passage in the document text.
 */
export function ChatPanel({ contractId, onLocate, onClose, className }) {
  const chat = useChat(contractId)
  const [draft, setDraft] = useState('')
  const listRef = useRef(null)

  const ready = chat.indexStatus === 'ready'
  const preparing = chat.indexStatus === 'indexing' || chat.indexStatus === 'not_indexed'

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [chat.messages.length, chat.sending])

  const submit = async (text = draft) => {
    if (!ready) return
    setDraft('')
    const sent = await chat.send(text)
    if (!sent) setDraft(text)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <section
      aria-label="Ask the document"
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquareText className="h-4 w-4 shrink-0 text-accent-700 dark:text-accent-400" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Ask the document</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {chat.messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={chat.clear} title="Clear the conversation">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Clear conversation</span>
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} title="Close chat">
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Close chat</span>
            </Button>
          )}
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {chat.loading && !chat.indexStatus && (
          <div className="flex justify-center py-8">
            <Spinner label="Loading the conversation" />
          </div>
        )}

        {chat.error && (
          <Alert tone="danger" title="Could not load the chat">
            {chat.error.message}
          </Alert>
        )}

        {preparing && (
          <div className="flex items-start gap-3 rounded-md bg-stone-50 px-3 py-3 text-sm dark:bg-stone-950" role="status">
            <Spinner />
            <p className="text-stone-600 dark:text-stone-400">
              Getting the document ready for your questions. This takes a few seconds.
            </p>
          </div>
        )}

        {chat.indexStatus === 'failed' && (
          <Alert
            tone="danger"
            title="This document isn’t ready for questions yet"
            action={
              <Button size="sm" variant="secondary" onClick={chat.reindex}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </Button>
            }
          >
            {chat.indexError}
          </Alert>
        )}

        {chat.messages.map((message) => (
          <ChatMessage key={message.message_id} message={message} onLocate={onLocate} />
        ))}

        {chat.sending && (
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400" role="status">
            <Spinner label="Searching the document" />
            Searching the document…
          </div>
        )}
      </div>

      {chat.sendError && (
        <div className="px-4 pb-2">
          <Alert tone="danger">{chat.sendError.message}</Alert>
        </div>
      )}

      <form
        className="flex items-end gap-2 border-t border-stone-200 p-3 dark:border-stone-800"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label htmlFor={`chat-input-${contractId}`} className="sr-only">
          Your question
        </label>
        <textarea
          id={`chat-input-${contractId}`}
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!ready || chat.sending}
          maxLength={4000}
          placeholder={ready ? 'Ask a question… (Enter to send)' : 'Preparing the document…'}
          className="min-h-[2.75rem] flex-1 resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-950"
        />
        <Button type="submit" disabled={!ready || !draft.trim()} loading={chat.sending} title="Send">
          {!chat.sending && <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </section>
  )
}
