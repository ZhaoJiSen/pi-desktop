import { useLayoutEffect, useRef, useState } from 'react'
import { observeTextTruncation } from '../lib/textOverflow'

export function useTextTruncated(text: string) {
  const ref = useRef<HTMLElement>(null)
  const [truncated, setTruncated] = useState(false)
  useLayoutEffect(() => {
    const element = ref.current
    if (element) return observeTextTruncation(element, setTruncated)
  }, [text])
  return { ref, truncated }
}
