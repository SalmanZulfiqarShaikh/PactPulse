import { useEffect, useState } from 'react'

/**
 * Track a CSS media query from JavaScript.
 *
 * The initial value is read synchronously so the first paint is already right -
 * a section that starts open on desktop must not flash closed first. Only the
 * listener is deferred to an effect.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined

    const list = window.matchMedia(query)
    const handleChange = (event) => setMatches(event.matches)

    setMatches(list.matches)
    list.addEventListener('change', handleChange)

    return () => list.removeEventListener('change', handleChange)
  }, [query])

  return matches
}
