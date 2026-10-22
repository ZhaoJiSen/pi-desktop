import { useLayoutEffect, useRef, useState } from 'react'

const overscan = 12
type Anchor = {
  content: unknown
  layout: string
  at: (index: number) => string | undefined
  find: (key: string) => number | undefined
}

/** Window a file against its existing panel scroller, including accordion clips. */
export function useDiffWindow(count: number, rowHeight: number, anchor: Anchor) {
  const ref = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ start: 0, end: 48 })
  const previous = useRef<{ content: unknown; layout: string; key: string; offset: number } | null>(
    null,
  )

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const ancestors: HTMLElement[] = []
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      ancestors.push(parent)
    }
    // Embedded files share the panel; a standalone history diff scrolls itself.
    // Resolve before expansion too, when scrollHeight may still be zero.
    const scroller =
      element.closest<HTMLElement>('.source-scroll') ??
      element.closest<HTMLElement>('.source-git-diff')
    const scrollTopEdge = () =>
      Math.max(0, scroller ? scroller.getBoundingClientRect().top + scroller.clientTop : 0)
    let frame = 0
    const viewport = () => {
      const bounds = element.getBoundingClientRect()
      let top = 0
      let bottom = window.innerHeight
      for (const parent of ancestors) {
        if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowY)) continue
        const clip = parent.getBoundingClientRect()
        top = Math.max(top, clip.top + parent.clientTop)
        bottom = Math.min(bottom, clip.top + parent.clientTop + parent.clientHeight)
      }
      return { bounds, top, bottom }
    }
    const last = previous.current
    if (last && last.content === anchor.content && last.layout !== anchor.layout) {
      const index = anchor.find(last.key)
      if (index !== undefined && scroller) {
        const { bounds } = viewport()
        scroller.scrollTop += index * rowHeight + last.offset - (scrollTopEdge() - bounds.top)
      }
    }
    const measure = () => {
      frame = 0
      const { bounds, top, bottom } = viewport()
      const visibleTop = Math.max(top, bounds.top)
      const visibleBottom = Math.min(bottom, bounds.bottom)
      const anchorTop = scrollTopEdge()
      const first = Math.max(0, Math.floor((anchorTop - bounds.top) / rowHeight))
      const key = anchor.at(first)
      previous.current =
        scroller &&
        scroller.scrollTop > 0 &&
        bounds.top <= anchorTop &&
        bounds.bottom > anchorTop &&
        bottom > top &&
        key
          ? {
              content: anchor.content,
              layout: anchor.layout,
              key,
              offset: anchorTop - bounds.top - first * rowHeight,
            }
          : null
      const start = Math.max(0, Math.floor((visibleTop - bounds.top) / rowHeight) - overscan)
      const end = Math.min(count, Math.ceil((visibleBottom - bounds.top) / rowHeight) + overscan)
      const next = visibleBottom <= visibleTop ? { start: 0, end: 0 } : { start, end }
      setRange((current) =>
        current.start === next.start && current.end === next.end ? current : next,
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    for (const parent of ancestors) {
      observer.observe(parent)
      parent.addEventListener('scroll', schedule, { passive: true })
    }
    window.addEventListener('resize', schedule)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      for (const parent of ancestors) parent.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [anchor, count, rowHeight])

  return { ref, start: Math.min(count, range.start), end: Math.min(count, range.end) }
}
