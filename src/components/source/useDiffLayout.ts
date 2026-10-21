import { useCallback, useEffect, useRef, useState } from 'react'

type DiffLayout = 'unified' | 'split'

// Leave room for both line-number gutters and readable code on either side.
// Separate thresholds prevent flicker while dragging around the breakpoint.
const SPLIT_AT = 720
const UNIFIED_BELOW = 680

export function useDiffLayout(enabled = true) {
  const [automatic, setAutomatic] = useState<DiffLayout>('unified')
  const [manual, setManual] = useState<DiffLayout | null>(null)
  const current = useRef<DiffLayout>('unified')
  const measuredWidth = useRef(0)
  const manualWidth = useRef<number | null>(null)
  const cleanup = useRef<(() => void) | null>(null)

  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      cleanup.current?.()
      cleanup.current = null
      if (!element || !enabled) return
      const measure = (width: number) => {
        // Closed accordion panels have no width; wait until they become visible.
        if (width <= 0) return
        measuredWidth.current = width
        if (manualWidth.current !== null && Math.abs(width - manualWidth.current) >= 24) {
          manualWidth.current = null
          setManual(null)
        }
        const next =
          width >= SPLIT_AT ? 'split' : width < UNIFIED_BELOW ? 'unified' : current.current
        if (next === current.current) return
        current.current = next
        setAutomatic(next)
        manualWidth.current = null
        setManual(null)
      }
      measure(element.getBoundingClientRect().width)
      const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width))
      observer.observe(element)
      cleanup.current = () => observer.disconnect()
    },
    [enabled],
  )
  useEffect(() => () => cleanup.current?.(), [])

  function setLayout(layout: DiffLayout) {
    manualWidth.current = measuredWidth.current
    setManual(layout)
  }

  // Small rounding changes preserve a manual choice; a deliberate resize
  // returns to automatic layout even when both sizes are in the same band.
  return { ref, layout: manual ?? automatic, setLayout }
}
