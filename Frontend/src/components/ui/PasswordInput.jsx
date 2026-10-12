import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from './Input'
import { cn } from '../../lib/cn'

/**
 * A password field with a show/hide toggle and a Caps Lock warning.
 *
 * The toggle is a real button carrying `aria-pressed`, and its label says what
 * it does rather than naming the icon. It stays in the tab order: not being able
 * to check what you typed is the problem it exists to solve.
 *
 * The Caps Lock warning saves a round trip. A masked password typed with Caps
 * Lock on looks exactly like a wrong password, and the fix is one keystroke.
 */
export function PasswordInput({
  className,
  autoComplete = 'current-password',
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}) {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  // `getModifierState` is the only dependable read. Watching for the Caps Lock
  // key itself is unreliable: some platforms swallow it, and the lock can
  // already be on before focus arrives.
  const trackCapsLock = (event) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLock(event.getModifierState('CapsLock'))
    }
  }

  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          // Room for the toggle, so a long value does not run underneath it.
          className={cn('pr-10', className)}
          onKeyDown={(event) => {
            trackCapsLock(event)
            onKeyDown?.(event)
          }}
          onKeyUp={(event) => {
            trackCapsLock(event)
            onKeyUp?.(event)
          }}
          onBlur={(event) => {
            // The warning is about typing, so it leaves when focus does.
            setCapsLock(false)
            onBlur?.(event)
          }}
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none dark:text-stone-400 dark:hover:text-stone-100"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* `role="status"` announces it politely rather than interrupting. The
          warning is written out, never signalled by colour alone. */}
      {capsLock && (
        <p
          role="status"
          className="mt-1.5 animate-fade-in text-xs text-amber-700 motion-reduce:animate-none dark:text-amber-400"
        >
          Caps Lock is on.
        </p>
      )}
    </div>
  )
}
