import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, CircleDashed, CircleMinus, CircleCheck, TriangleAlert } from 'lucide-react'

import { buttonClasses } from '../ui/Button'
import { cn } from '../../lib/cn'
import { CHECKS, FAQS, TRANSLATIONS } from './content'
import { MarkedUpPage } from './MarkedUpPage'

const SECTION = 'mx-auto max-w-6xl scroll-mt-20 px-4 sm:px-6'
const H2 = 'font-grotesk text-[1.9rem] font-bold leading-[1.15] tracking-[-0.02em] text-[#1B2A38] text-balance sm:text-[2.35rem] dark:text-stone-50'
const LEAD = 'mt-4 max-w-[60ch] text-[1.05rem] leading-relaxed text-[#1B2A38]/75 dark:text-stone-400'

export function Hero({ authenticated }) {
  return (
    <section className={`${SECTION} pb-20 pt-14 sm:pt-20`}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="lg:pt-6">
          <h1 className="font-grotesk text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-[#1B2A38] text-balance sm:text-[3.4rem] dark:text-stone-50">
            Read contracts in minutes, not hours.
          </h1>
          <p className={LEAD}>
            Pact Pulse reads the agreement, flags the clauses that could hurt your client, and tells
            you what to negotiate, so you walk into every meeting prepared.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 font-grotesk">
            <Link to={authenticated ? '/app/upload' : '/register'} className={buttonClasses({ size: 'lg' })}>
              Review a contract
            </Link>
            {!authenticated && (
              <Link to="/login" className={buttonClasses({ size: 'lg', variant: 'ghost' })}>
                Log in
              </Link>
            )}
          </div>
          <p className="mt-6 max-w-[46ch] text-sm leading-relaxed text-[#1B2A38]/60 dark:text-stone-500">
            Made for advocates and law firms in Pakistan. Works with PDF, Word and scanned stamp
            paper.
          </p>
        </div>

        <MarkedUpPage />
      </div>
    </section>
  )
}

export function PlainWords() {
  return (
    <section id="plain-words" aria-labelledby="plain-words-heading" className="border-y border-[#D6DCDA] bg-white py-20 dark:border-stone-800 dark:bg-stone-900">
      <div className={SECTION}>
        <h2 id="plain-words-heading" className={H2}>
          Turn legal drafting into advice your client understands.
        </h2>
        <p className={LEAD}>
          Each clause is explained the way you would explain it across the table, right next to
          the wording it came from. Copy it straight into your note to the client.
        </p>

        <table className="mt-12 w-full border-collapse text-left">
          <caption className="sr-only">Contract wording and its plain-language meaning</caption>
          <thead className="hidden md:table-header-group">
            <tr className="font-grotesk text-sm text-[#1B2A38]/60 dark:text-stone-500">
              <th scope="col" className="w-40 pb-3 font-medium">Topic</th>
              <th scope="col" className="pb-3 pr-10 font-medium">What the contract says</th>
              <th scope="col" className="pb-3 font-medium">What it means for you</th>
            </tr>
          </thead>
          <tbody>
            {TRANSLATIONS.map((row) => (
              <tr key={row.topic} className="grid gap-2 border-t border-[#D6DCDA] py-6 md:table-row dark:border-stone-800">
                <th scope="row" className="align-top font-grotesk text-base font-semibold text-[#1B2A38] md:py-6 md:pr-6 dark:text-stone-100">
                  {row.topic}
                </th>
                <td className="align-top font-document text-[1rem] leading-[1.7] text-[#2C3A47]/80 md:py-6 md:pr-10 dark:text-stone-400">
                  {row.original}
                </td>
                <td className="align-top font-grotesk text-[1.05rem] leading-relaxed text-[#1B2A38] md:py-6 dark:text-stone-100">
                  {row.plain}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function AskSection() {
  return (
    <section id="ask" aria-labelledby="ask-heading" className={`${SECTION} py-20`}>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 id="ask-heading" className={H2}>
            Ask the contract a question. Get the clause back.
          </h2>
          <p className={LEAD}>
            “Can they terminate early?” “Who pays stamp duty?” “What happens on default?” Ask in
            your own words and get a straight answer from the document itself.
          </p>
          <ul className="mt-6 max-w-[56ch] space-y-3 text-[1.02rem] leading-relaxed text-[#1B2A38]/80 marker:text-accent-600 list-disc pl-5 dark:text-stone-300">
            <li>Every answer points to the clause it came from, one click away.</li>
            <li>No more scrolling through sixty pages to find one notice period.</li>
            <li>Works on judgments, policies and long correspondence too, not just contracts.</li>
          </ul>
        </div>

        <ChatExample />
      </div>
    </section>
  )
}

function Cite({ n }) {
  return (
    <span className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-accent-100 px-1 align-text-top text-[10px] font-semibold text-accent-800">
      {n}
    </span>
  )
}

function ChatExample() {
  return (
    <figure
      aria-label="Example conversation with a lease"
      className="rounded-md border border-[#D6DCDA] bg-white p-5 font-grotesk text-[#1B2A38] sm:p-6 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100"
    >
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-lg rounded-br-sm bg-accent-700 px-3.5 py-2 text-sm text-white">
          Can the landlord raise the rent mid-year?
        </p>
      </div>
      <div className="mt-4 space-y-2 text-sm leading-relaxed">
        <p>
          No. The rent is fixed for the first 12 months<Cite n={4} />. After that it can rise by up
          to 10% a year, with 60 days’ written notice<Cite n={11} />.
        </p>
        <p>
          The lease doesn’t say what happens if you refuse the increase, so it’s worth asking for
          that to be added<Cite n={11} />.
        </p>
      </div>
      <p className="mt-4 border-t border-[#D6DCDA] pt-3 text-xs text-[#1B2A38]/60 dark:border-stone-800 dark:text-stone-500">
        From clauses 4 and 11 of the lease
      </p>
    </figure>
  )
}

const CHECK_STYLE = {
  attention: { icon: TriangleAlert, label: 'Needs attention', className: 'text-amber-600' },
  missing: { icon: CircleDashed, label: 'Not covered', className: 'text-[#B3261E] dark:text-red-400' },
  fine: { icon: CircleCheck, label: 'Looks fine', className: 'text-emerald-600' },
  na: { icon: CircleMinus, label: 'Not relevant', className: 'text-stone-400' },
}

export function ChecklistSection() {
  return (
    <section aria-labelledby="checks-heading" className="border-y border-[#D6DCDA] bg-white py-20 dark:border-stone-800 dark:bg-stone-900">
      <div className={`${SECTION} grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`}>
        <div>
          <h2 id="checks-heading" className={H2}>
            Nothing slips past you.
          </h2>
          <p className={LEAD}>
            Every agreement is checked against the same twelve points, from liability caps to
            personal guarantees. A missing protection gets flagged every time, not just when it
            happens to stand out.
          </p>
        </div>

        <ul className="grid gap-x-8 sm:grid-cols-2" aria-label="Example checklist for a services agreement">
          {CHECKS.map(([label, status]) => {
            const { icon: Icon, label: statusLabel, className } = CHECK_STYLE[status]
            return (
              <li key={label} className="flex items-start gap-3 border-b border-[#D6DCDA] py-3 font-grotesk dark:border-stone-800">
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} aria-hidden="true" />
                <span className="flex-1 text-[0.95rem] text-[#1B2A38] dark:text-stone-200">{label}</span>
                <span className="text-xs text-[#1B2A38]/55 dark:text-stone-500">{statusLabel}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function PrivacySection() {
  return (
    <section id="privacy" aria-labelledby="privacy-heading" className={`${SECTION} py-20`}>
      <h2 id="privacy-heading" className={H2}>
        Built for confidential work
      </h2>
      <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
        {[
          ['Private to you', 'Your documents are visible only to your account. Nobody else in the system can open them.'],
          ['Delete whenever you want', 'Remove a matter and everything about it goes with it: the file, the review and the conversation.'],
          ['Processed by Google’s AI', 'Reviews are prepared using Google’s AI service. For highly sensitive matters, check your firm’s policy before uploading.'],
          ['Your judgment stays in charge', 'Pact Pulse prepares the first read. You decide what it means for your client.'],
        ].map(([term, detail]) => (
          <div key={term} className="border-t-2 border-[#1B2A38] pt-4 dark:border-stone-300">
            <dt className="font-grotesk text-lg font-semibold text-[#1B2A38] dark:text-stone-100">{term}</dt>
            <dd className="mt-2 max-w-[52ch] leading-relaxed text-[#1B2A38]/75 dark:text-stone-400">{detail}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-10 max-w-[60ch] text-sm leading-relaxed text-[#1B2A38]/60 dark:text-stone-500">
        Pact Pulse is a research and review aid, not legal advice. Always confirm a clause against
        the original before relying on it.
      </p>
    </section>
  )
}

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="border-t border-[#D6DCDA] bg-white py-20 dark:border-stone-800 dark:bg-stone-900">
      <div className={`${SECTION} grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`}>
        <h2 id="faq-heading" className={H2}>
          Common questions
        </h2>
        <div className="border-b border-[#D6DCDA] dark:border-stone-800">
          {FAQS.map((item) => (
            <FaqItem key={item.question} {...item} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqItem({ question, answer }) {
  const regionId = useId()
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-[#D6DCDA] dark:border-stone-800">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={regionId}
          className="flex w-full items-start justify-between gap-4 py-5 text-left font-grotesk text-[1.05rem] font-semibold text-[#1B2A38] dark:text-stone-100"
        >
          {question}
          <ChevronDown
            className={cn('mt-1 h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div id={regionId} hidden={!open}>
        <p className="max-w-[62ch] pb-5 leading-relaxed text-[#1B2A38]/75 dark:text-stone-400">{answer}</p>
      </div>
    </div>
  )
}

export function ClosingCall({ authenticated }) {
  return (
    <section className={`${SECTION} py-20`}>
      <div className="flex flex-col items-start justify-between gap-6 border-t-2 border-[#1B2A38] pt-8 md:flex-row md:items-end dark:border-stone-300">
        <h2 className={`${H2} max-w-[22ch]`}>Spend your time on the advice, not the reading.</h2>
        <Link to={authenticated ? '/app/upload' : '/register'} className={buttonClasses({ size: 'lg', className: 'font-grotesk' })}>
          Review a contract
        </Link>
      </div>
    </section>
  )
}
