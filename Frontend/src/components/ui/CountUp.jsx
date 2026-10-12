import { useEffect, useState } from 'react'

/**
 * Counts from zero up to `value`, once, on mount.
 *
 * Used only for counts the API actually returned. There is no decorative number
 * on this site to animate, and inventing one to have something moving would be
 * a claim the product cannot back.
 *
 * Under `prefers-reduced-motion` the final value is set immediately - the whole
 * point of the animation is the movement, so there is nothing to keep.
 */
export function CountUp({ value, duration = 500, className }) {
  const target = Number(value) || 0
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced || target === 0 || typeof requestAnimationFrame === 'undefined') {
      setCurrent(target)
      return
    }

    let frame = 0
    const startedAt = performance.now()

    const step = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1)
      // Ease out cubic: quick off the mark, settling on the final digit rather
      // than stopping dead on it.
      setCurrent(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  // `tabular-nums` keeps the text from shifting sideways as digits change.
  return <span className={className ? `tabular-nums ${className}` : 'tabular-nums'}>{current}</span>
}
