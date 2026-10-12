import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  ChevronDown,
  FileText,
  Github,
  Globe,
  Linkedin,
  Menu,
  PencilLine,
  Quote,
  Scale,
  X,
} from 'lucide-react'

import { ThemeToggle } from '../components/layout/ThemeToggle'
import { buttonClasses } from '../components/ui/Button'
import { Reveal } from '../components/ui/Reveal'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'

// --- Content -----------------------------------------------------------------
//
// Every claim on this page is checked against the backend. See the
// confidentiality section in particular: it names Google as the processing
// service because that is genuinely where an uploaded document goes, and it
// claims no certification the code cannot prove.

const STEPS = [
  {
    title: 'Upload',
    body: 'Choose a PDF, Word document or text file. The text is extracted straight away so you can check it came through cleanly.',
  },
  {
    title: 'Review the summary',
    body: 'You get a short plain-language summary, the key dates and obligations, and the clauses that need a closer look.',
  },
  {
    title: 'Act on the risks',
    body: 'Each flagged clause comes with what it means, what to do about it, and the exact wording it was drawn from.',
  },
]

const FEATURES = [
  {
    icon: FileText,
    title: 'A summary in plain words',
    body: 'What the contract does, written the way you would explain it to a client, not the way the draftsperson wrote it.',
  },
  {
    icon: Quote,
    title: 'The exact wording, quoted',
    body: 'Every flagged clause is quoted verbatim from your document, so you can check the analysis against the source.',
  },
  {
    icon: PencilLine,
    title: 'A suggested fix',
    body: 'Each finding says what to do next, whether that is negotiating the term, adding a definition, or leaving it alone.',
  },
  {
    icon: CalendarClock,
    title: 'Dates and duties in one place',
    body: 'Term, notice periods, and what each party has to do, gathered into one list instead of scattered through the document.',
  },
]

const FAQS = [
  {
    question: 'What file types can I upload?',
    answer:
      'PDF, DOCX and TXT, up to 10 MB. Scanned PDFs contain no text layer, so their contents cannot be read - if the upload says the document is empty, that is usually why.',
  },
  {
    question: 'How long does an analysis take?',
    answer:
      'Usually under a minute. Longer contracts are split into sections and analysed in parts, which takes longer. You can leave the page open and the report appears when it is ready.',
  },
  {
    question: 'Is this legal advice?',
    answer:
      'No. Pact Pulse runs an automated analysis. It can be wrong, it can miss things, and it can quote a clause inaccurately. Treat the report as a first pass and read the contract before you rely on anything in it.',
  },
  {
    question: 'Who can see my contracts?',
    answer:
      'Only the account that uploaded them. Every request is checked against your session, and a contract belonging to another account is reported as not found rather than shown.',
  },
  {
    question: 'Can I delete a contract?',
    answer:
      'Yes, from the dashboard or the contract page. Deleting removes the contract, its analysis report and the stored file, and it cannot be undone.',
  },
  {
    question: 'What happens to a long contract?',
    answer:
      'It is split into sections and the findings are combined into one report. Detail can be lost where sections meet, so check any quotation against the original. The report says when this has happened.',
  },
]

// --- Page --------------------------------------------------------------------

const AUTHOR = 'Salman Zulfiqar Shaikh'

const AUTHOR_LINKS = [
  { label: 'Website', href: 'https://www.salmanzulfi.dev', icon: Globe },
  { label: 'GitHub', href: 'https://www.github.com/SalmanZulfiqarShaikh', icon: Github },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/SalmanZulfiqarShaikh', icon: Linkedin },
]

export function Landing() {
  const { isAuthenticated } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <SiteNav
        authenticated={isAuthenticated}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <main>
        <Hero authenticated={isAuthenticated} />
        <HowItWorks />
        <WhatYouGet />
        <Confidentiality />
        <Faq />
      </main>

      <SiteFooter />
    </div>
  )
}

function SiteNav({ authenticated, menuOpen, onToggleMenu, onCloseMenu }) {
  const menuId = useId()

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
        >
          <Scale className="h-5 w-5 text-accent-700 dark:text-accent-400" aria-hidden="true" />
          Pact Pulse
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <a
            href="#how-it-works"
            className="rounded-md px-3 py-2 text-sm text-stone-600 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-stone-400 dark:hover:text-stone-100"
          >
            How it works
          </a>

          <a
            href="#faq"
            className="rounded-md px-3 py-2 text-sm text-stone-600 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-stone-400 dark:hover:text-stone-100"
          >
            FAQ
          </a>

          <span className="mx-2 h-5 w-px bg-stone-200 dark:bg-stone-800" aria-hidden="true" />

          <ThemeToggle />

          {authenticated ? (
            <Link to="/app" className={buttonClasses({ className: 'ml-2' })}>
              Open app
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="ml-2 rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-stone-300 dark:hover:text-stone-100"
              >
                Log in
              </Link>

              <Link to="/register" className={buttonClasses({ className: 'ml-1' })}>
                Get started
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />

          <button
            type="button"
            onClick={onToggleMenu}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="rounded-md p-2 text-stone-600 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-stone-400 dark:hover:bg-stone-800"
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id={menuId}
          aria-label="Main"
          className="border-t border-stone-200 bg-stone-50 px-4 py-3 md:hidden dark:border-stone-800 dark:bg-stone-950"
        >
          <ul className="space-y-1">
            <li>
              <a
                href="#how-it-works"
                onClick={onCloseMenu}
                className="block rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                How it works
              </a>
            </li>
            <li>
              <a
                href="#faq"
                onClick={onCloseMenu}
                className="block rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                FAQ
              </a>
            </li>
          </ul>

          <div className="mt-3 flex flex-col gap-2 border-t border-stone-200 pt-3 dark:border-stone-800">
            {authenticated ? (
              <Link to="/app" className={buttonClasses({ className: 'w-full' })}>
                Open app
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonClasses({ variant: 'secondary', className: 'w-full' })}>
                  Log in
                </Link>
                <Link to="/register" className={buttonClasses({ className: 'w-full' })}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}

function Hero({ authenticated }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
      <div className="max-w-2xl">
        <Reveal as="h1" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Understand any contract in minutes
        </Reveal>

        <Reveal
          as="p"
          delay={80}
          className="mt-4 max-w-prose text-base leading-relaxed text-stone-600 sm:text-lg dark:text-stone-400"
        >
          Upload a contract. Get a plain-language summary, the risky clauses highlighted, and
          suggested fixes.
        </Reveal>

        <Reveal delay={160} className="mt-8 flex flex-wrap items-center gap-4">
          {authenticated ? (
            <Link to="/app" className={buttonClasses({ size: 'lg' })}>
              Open app
            </Link>
          ) : (
            <Link to="/register" className={buttonClasses({ size: 'lg' })}>
              Get started
            </Link>
          )}

          <a
            href="#how-it-works"
            className="rounded-md text-sm font-medium text-accent-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-accent-400"
          >
            See how it works
          </a>
        </Reveal>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-20 border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal as="h2" id="how-it-works-heading" className="text-2xl font-semibold tracking-tight">
          How it works
        </Reveal>

        <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, index) => (
            <Reveal
              as="li"
              key={step.title}
              delay={index * 90}
              className="group transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-300 text-xs font-semibold text-stone-600 transition-colors tabular-nums group-hover:border-accent-400 group-hover:text-accent-700 dark:border-stone-700 dark:text-stone-300 dark:group-hover:border-accent-500 dark:group-hover:text-accent-300"
                aria-hidden="true"
              >
                {index + 1}
              </span>

              <h3 className="mt-3 text-base font-medium">{step.title}</h3>

              <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                {step.body}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

function WhatYouGet() {
  return (
    <section
      aria-labelledby="what-you-get-heading"
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20"
    >
      <Reveal as="h2" id="what-you-get-heading" className="text-2xl font-semibold tracking-tight">
        What you get
      </Reveal>

      <ul className="mt-8 grid gap-6 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }, index) => (
          <Reveal
            as="li"
            key={title}
            delay={(index % 2) * 90}
            className="group flex gap-4 rounded-lg border border-transparent transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-stone-200 text-stone-500 transition-colors group-hover:border-accent-300 group-hover:text-accent-700 dark:border-stone-800 dark:text-stone-400 dark:group-hover:border-accent-700 dark:group-hover:text-accent-300">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <h3 className="text-base font-medium">{title}</h3>
              <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                {body}
              </p>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}

function Confidentiality() {
  return (
    <section
      id="confidentiality"
      aria-labelledby="confidentiality-heading"
      className="scroll-mt-20 border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal
          as="h2"
          id="confidentiality-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Confidentiality
        </Reveal>

        <Reveal delay={90} className="mt-6 max-w-prose space-y-4 text-base leading-relaxed text-stone-600 dark:text-stone-400">
          <p>
            Your contracts are private to your account. Every request is checked against your session,
            and a contract that belongs to someone else is reported as not found rather than shown.
          </p>

          <p>
            You can delete a contract whenever you want. Deleting it removes the contract, its analysis
            report and the stored document, permanently.
          </p>

          <p>
            Passwords are stored as one-way hashes, not as readable text, and your session token is
            held in memory rather than kept in your browser&apos;s storage.
          </p>

          <p>
            The analysis is run by Google&apos;s Gemini API, so the text of a contract you upload is
            sent to Google for that processing. If a document cannot leave your organisation, do not
            upload it here.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <Reveal as="h2" id="faq-heading" className="text-2xl font-semibold tracking-tight">
        Common questions
      </Reveal>

      <Reveal
        delay={90}
        className="mt-8 max-w-2xl divide-y divide-stone-200 border-y border-stone-200 dark:divide-stone-800 dark:border-stone-800"
      >
        {FAQS.map((item) => (
          <FaqItem key={item.question} {...item} />
        ))}
      </Reveal>
    </section>
  )
}

function FaqItem({ question, answer }) {
  const regionId = useId()
  const [open, setOpen] = useState(false)

  return (
    <div>
      <h3>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={regionId}
          className="flex w-full items-start justify-between gap-4 py-4 text-left hover:text-accent-800 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:hover:text-accent-300"
        >
          <span className="text-base font-medium">{question}</span>

          <ChevronDown
            className={cn(
              'mt-1 h-4 w-4 shrink-0 text-stone-500 transition-transform duration-300 motion-reduce:transition-none dark:text-stone-400',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </h3>

      {/* The answer stays mounted and the row is animated between 0fr and 1fr,
          which gives a real height transition without measuring anything. It is
          hidden from assistive technology while shut, and holds nothing
          focusable, so nothing here can be tabbed into while invisible. */}
      <div
        id={regionId}
        aria-hidden={!open}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="max-w-prose pb-4 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            {answer}
          </p>
        </div>
      </div>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 dark:border-stone-800">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-accent-700 dark:text-accent-400" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-tight">Pact Pulse</span>
          </div>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {AUTHOR_LINKS.map(({ label, href, icon: Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  // External, so it opens alongside the page rather than
                  // replacing it. `noreferrer` also withholds the referrer.
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-md text-sm text-stone-600 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-stone-400 dark:hover:text-stone-100"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-stone-200 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Made by{' '}
            <a
              href="https://www.salmanzulfi.dev"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded font-medium text-stone-800 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-stone-200"
            >
              {AUTHOR}
            </a>
          </p>

          <p className="text-sm text-stone-600 dark:text-stone-400">
            Pact Pulse provides automated analysis, not legal advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
