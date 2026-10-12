import { NavLink, useNavigate } from 'react-router-dom'
import { FileText, LogOut, Scale, Upload, User } from 'lucide-react'

import { cn } from '../../lib/cn'
import { useAuth } from '../../context/AuthContext'

export const NAV_ITEMS = [
  { to: '/app', label: 'Contracts', icon: FileText, end: true },
  { to: '/app/upload', label: 'Upload', icon: Upload },
  { to: '/app/account', label: 'Account', icon: User },
]

function navLinkClasses({ isActive }) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100',
  )
}

/** Desktop navigation. Hidden below `md`; the bottom bar takes over there. */
export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="hidden w-60 shrink-0 border-r border-stone-200 bg-white md:flex md:flex-col dark:border-stone-800 dark:bg-stone-900">
      <div className="flex h-14 items-center gap-2 border-b border-stone-200 px-4 dark:border-stone-800">
        <Scale className="h-5 w-5 text-accent-700 dark:text-accent-400" aria-hidden="true" />
        <span className="text-sm font-semibold tracking-tight">Pact Pulse</span>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Main">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClasses}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-stone-200 p-4 dark:border-stone-800">
        <p className="text-xs text-stone-500 dark:text-stone-400">Signed in as</p>
        <p className="mt-0.5 truncate text-xs font-medium" title={user?.email || undefined}>
          {user?.email || 'Your account'}
        </p>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  )
}

/** Mobile navigation, pinned to the bottom of the viewport. */
export function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white md:hidden dark:border-stone-800 dark:bg-stone-900"
      aria-label="Main"
    >
      <ul className="flex">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-accent-700 dark:text-accent-400'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100',
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
