import { useLayoutEffect, useRef, useState } from 'react'

export function useTextTruncated(text: string) {
  const ref = useRef<HTMLElement>(null)
  const [truncated, setTruncated] = useState(false)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setTruncated(element.scrollWidth > element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text])

  return { ref, truncated }
}
