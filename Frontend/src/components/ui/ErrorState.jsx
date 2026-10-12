import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from './Button'

/**
 * A failed request, with a way out. `ApiError` already turns the response into
 * a readable sentence, so this only has to present it.
 */
export function ErrorState({ error, onRetry, title = 'Something went wrong', className }) {
  const isAuth = error?.isAuth
  const isNetwork = error?.isNetwork

  return (
    <div
      role="alert"
      className={
        'rounded-lg border border-stone-200 bg-white px-6 py-10 text-center dark:border-stone-800 dark:bg-stone-900 ' +
        (className ?? '')
      }
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-amber-200 text-amber-600 dark:border-amber-900 dark:text-amber-400">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-sm font-semibold">
        {isAuth ? 'Your session has ended' : isNetwork ? 'Cannot reach the server' : title}
      </h3>

      <p className="mx-auto mt-1 max-w-md text-sm text-stone-600 dark:text-stone-400">
        {error?.message || 'The request failed. Try again.'}
      </p>

      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
