import { Scale } from 'lucide-react'

import { AUTHOR } from './content'

export function SiteFooter() {
  return (
    <footer className="border-t border-[#D6DCDA] font-grotesk dark:border-stone-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2 text-sm">
          <Scale className="h-4 w-4 text-accent-700 dark:text-accent-400" aria-hidden="true" />
          <span className="font-bold tracking-tight">Pact Pulse</span>
          <span className="text-stone-500 dark:text-stone-400">
            by{' '}
            <a href={AUTHOR.site} target="_blank" rel="noreferrer noopener" className="text-stone-700 underline-offset-4 hover:underline dark:text-stone-300">
              {AUTHOR.name}
            </a>
          </span>
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {AUTHOR.links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline dark:text-stone-400 dark:hover:text-stone-100"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
