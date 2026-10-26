import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '../../lib/cn'

// [P12] or [P3][P7] in the answer become clickable source chips.
const CITATION = /\[P(\d+)\]/g

function linkCitations(text) {
  return text.replace(CITATION, (_, number) => `[${number}](#passage-${number})`)
}

function CitationChip({ number, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Show passage ${number} in the document`}
      className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-accent-100 px-1 align-text-top text-[10px] font-semibold text-accent-800 hover:bg-accent-200 dark:bg-accent-900 dark:text-accent-200 dark:hover:bg-accent-800"
    >
      {number}
    </button>
  )
}

const PROSE =
  'space-y-2 text-sm leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-stone-300 [&_blockquote]:pl-3 [&_blockquote]:text-stone-600 dark:[&_blockquote]:border-stone-700 dark:[&_blockquote]:text-stone-400 [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:text-xs dark:[&_code]:bg-stone-800 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-stone-100 [&_pre]:p-3 dark:[&_pre]:bg-stone-800 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:border-stone-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-stone-200 [&_th]:px-2 [&_th]:py-1 dark:[&_td]:border-stone-700 dark:[&_th]:border-stone-700'

/** One chat bubble. Assistant answers render Markdown with clickable [P#] citations. */
export function ChatMessage({ message, onLocate }) {
  const isUser = message.role === 'user'
  const citations = message.citations ?? []
  const byNumber = new Map(citations.map((citation) => [citation.passage, citation]))

  const locate = (number) => {
    const citation = byNumber.get(number)
    if (citation) onLocate?.({ start: citation.start, end: citation.end })
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            'max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-accent-700 px-3.5 py-2 text-sm text-white dark:bg-accent-600',
            message.pending && 'opacity-70',
          )}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full">
      {message.search_only && (
        <p className="mb-1.5 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          AI unavailable · search results only
        </p>
      )}
      <div className={PROSE}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const match = href?.match(/^#passage-(\d+)$/)
              if (match) {
                const number = Number(match[1])
                return <CitationChip number={number} onClick={() => locate(number)} />
              }
              return (
                <a href={href} target="_blank" rel="noreferrer" className="underline">
                  {children}
                </a>
              )
            },
          }}
        >
          {linkCitations(message.content)}
        </Markdown>
      </div>

      {citations.length > 0 && (
        <details className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          <summary className="cursor-pointer select-none">
            {citations.length} {citations.length === 1 ? 'source' : 'sources'}
          </summary>
          <ul className="mt-1.5 space-y-1.5">
            {citations.map((citation) => (
              <li key={citation.passage}>
                <button
                  type="button"
                  onClick={() => locate(citation.passage)}
                  className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-left hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/60"
                >
                  <span className="font-semibold text-stone-700 dark:text-stone-300">
                    Passage {citation.passage}
                  </span>{' '}
                  <span className="line-clamp-2">{citation.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
