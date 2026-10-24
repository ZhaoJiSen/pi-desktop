/** Detect rendered ellipses, including clipped children in composite path labels. */
export function isTextTruncated(element: HTMLElement | null, deep = false): boolean {
  if (!element) return false
  const style = getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const horizontal =
    element.clientWidth > 0 &&
    style.textOverflow === 'ellipsis' &&
    (style.overflowX || style.overflow || 'visible') !== 'visible' &&
    element.scrollWidth > element.clientWidth
  const clamped =
    Number.parseInt(style.webkitLineClamp, 10) > 0 &&
    element.clientHeight > 0 &&
    element.scrollHeight > element.clientHeight
  return (
    horizontal ||
    clamped ||
    (deep &&
      Array.from(element.children).some(
        (child) => child instanceof HTMLElement && isTextTruncated(child, true),
      ))
  )
}

export function observeTextTruncation(
  element: HTMLElement,
  onChange: (truncated: boolean) => void,
  deep = false,
) {
  let live = true
  const measure = () => {
    if (live) onChange(isTextTruncated(element, deep))
  }
  measure()
  const observer = new ResizeObserver(measure)
  observer.observe(element)
  if (deep) element.querySelectorAll<HTMLElement>('*').forEach((child) => observer.observe(child))
  const fonts = element.ownerDocument.fonts
  fonts?.addEventListener('loadingdone', measure)
  void fonts?.ready.then(measure)
  return () => {
    live = false
    observer.disconnect()
    fonts?.removeEventListener('loadingdone', measure)
  }
}
