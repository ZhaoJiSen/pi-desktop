import { useLayoutEffect, useRef } from 'react'

// Animate the committed pane once, without remounting its content or delaying input.
export function usePaneTransition(key: string, { reveal = false } = {}) {
  const ref = useRef<HTMLDivElement>(null)
  const previous = useRef(key)
  useLayoutEffect(() => {
    const changed = previous.current !== key
    previous.current = key
    const pane = ref.current
    if ((!changed && !reveal) || !pane?.animate) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) return
    const animation = pane.animate([{ opacity: 0.72 }, { opacity: 1 }], {
      duration: 160,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    })
    // Apply the first frame before paint; begin playback after Activity restores
    // layout. Deferring creation itself would flash the fully visible pane first.
    animation.pause()
    animation.currentTime = 0
    const frame = requestAnimationFrame(() => animation.play())
    // Cancellation is expected during rapid navigation and Activity cleanup.
    void animation.finished.catch(() => {})
    const stop = () => {
      cancelAnimationFrame(frame)
      reduced.removeEventListener('change', stop)
      animation.onfinish = null
      animation.cancel()
    }
    reduced.addEventListener('change', stop)
    animation.onfinish = stop
    return stop
  }, [key, reveal])
  return ref
}
