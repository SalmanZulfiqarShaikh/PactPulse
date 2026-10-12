import { useEffect, useState } from 'react'

/**
 * Defers a fast-changing value (a search box) so the request fires once the
 * typing pauses rather than on every keystroke.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
