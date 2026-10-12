import { useEffect, useRef, useState } from 'react'

import { cn } from '../../lib/cn'

/**
 * Fades and lifts its children into place the first time they come into view.
 *
 * Three things this deliberately does:
 *
 * - It reveals **once**. The observer disconnects after it fires, so scrolling
 *   back up does not replay anything and the page settles down instead of
 *   twitching every time the reader moves.
 * - It is **skippable**. Under `prefers-reduced-motion` the utility classes
 *   below pin the element visible and cancel the animation, so the page arrives
 *   already settled rather than animating at someone who asked it not to.
 * - It **cannot strand content**. If `IntersectionObserver` is missing the
 *   element shows immediately. An invisible element is a worse failure than a
 *   missing animation, so the hidden state is never the only state.
 *
 * `delay` staggers a row of siblings; anything past about 200ms starts to feel
 * like waiting rather than polish.
 */
export function Reveal({ as: Tag = 'div', delay = 0, className, children, ...props }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      // Fires a little before the element is fully on screen, so it has finished
      // moving by the time it is properly in the reader's view.
      { rootMargin: '0px 0px -60px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      className={cn(
        shown ? 'animate-fade-up' : 'opacity-0',
        'motion-reduce:animate-none motion-reduce:opacity-100',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}
