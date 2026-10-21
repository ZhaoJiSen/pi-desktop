import { useCallback, useEffect, useRef, useState } from 'react'

export const codeRowHeight = 24
export const historyRowHeight = 48
export const searchRowHeight = 56
export const changeRowHeight = 36

export function useVirtualWindow(count: number, rowHeight: number, overscan = 8) {
  const node = useRef<HTMLDivElement | null>(null)
  const cleanup = useRef<(() => void) | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(640)
  const scroller = useCallback((element: HTMLDivElement | null) => {
    cleanup.current?.()
    cleanup.current = null
    node.current = element
    if (!element) return
    const onScroll = () => setScrollTop(element.scrollTop)
    element.addEventListener('scroll', onScroll, { passive: true })
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height ?? 0
      setHeight((current) => (current === next ? current : next))
    })
    observer.observe(element)
    cleanup.current = () => {
      element.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])
  const scrollTo = useCallback(
    (index: number) => {
      const element = node.current
      if (!element) return
      const top = Math.max(0, index) * rowHeight
      const bottom = top + rowHeight
      if (top < element.scrollTop) element.scrollTop = top
      else if (bottom > element.scrollTop + element.clientHeight) {
        element.scrollTop = bottom - element.clientHeight
      }
    },
    [rowHeight],
  )
  useEffect(() => () => cleanup.current?.(), [])
  const start = count === 0 ? 0 : Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visible = Math.ceil(height / rowHeight) + overscan * 2
  const end = Math.min(count, start + Math.max(visible, 1))
  return {
    scroller,
    scrollTo,
    start,
    end,
    paddingTop: start * rowHeight,
    paddingBottom: Math.max(0, count - end) * rowHeight,
  }
}
