import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Scale, X } from 'lucide-react'

import { ThemeToggle } from '../layout/ThemeToggle'
import { buttonClasses } from '../ui/Button'
import { NAV_LINKS } from './content'

const LINK = 'rounded-md px-3 py-2 text-sm text-[#1B2A38]/75 hover:text-[#1B2A38] dark:text-stone-400 dark:hover:text-stone-100'

export function SiteNav({ authenticated }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()

  const actions = authenticated ? (
    <Link to="/app" className={buttonClasses()}>
      Open your documents
    </Link>
  ) : (
    <>
      <Link to="/login" className={LINK}>
        Log in
      </Link>
      <Link to="/register" className={buttonClasses()}>
        Create account
      </Link>
    </>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-[#D6DCDA] bg-[#F2F4F3]/95 font-grotesk backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 rounded-md text-[0.95rem] font-bold tracking-tight">
          <Scale className="h-5 w-5 text-accent-700 dark:text-accent-400" aria-hidden="true" />
          Pact Pulse
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={LINK}>
              {link.label}
            </a>
          ))}
          <span className="mx-2 h-5 w-px bg-[#D6DCDA] dark:bg-stone-800" aria-hidden="true" />
          <ThemeToggle />
          <div className="ml-2 flex items-center gap-1">{actions}</div>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="rounded-md p-2 text-stone-600 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id={menuId} aria-label="Main" className="border-t border-[#D6DCDA] px-4 py-3 md:hidden dark:border-stone-800">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => setOpen(false)} className={`block ${LINK}`}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t border-[#D6DCDA] pt-3 dark:border-stone-800">
            {actions}
          </div>
        </nav>
      )}
    </header>
  )
}
