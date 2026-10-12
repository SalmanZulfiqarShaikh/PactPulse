import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from './ui/Button'

/**
 * Last line of defence: a render error anywhere below this boundary shows a
 * recoverable page instead of a blank screen.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error', error, info)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <div>
              <h1 className="text-base font-semibold">Something went wrong</h1>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                The page failed to render. Your contracts are safe — this is a display error.
              </p>
              <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-2 font-mono text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400">
                {String(error?.message || error)}
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={this.handleReset}>Try again</Button>
                {/* A full reload rather than a router navigation: the tree that
                    threw is the one being replaced. */}
                <Button variant="secondary" onClick={() => window.location.assign('/app')}>
                  Back to dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
