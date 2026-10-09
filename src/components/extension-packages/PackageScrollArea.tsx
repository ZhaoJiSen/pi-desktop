import { ScrollShadow } from '@heroui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

// macOS overlay scrollbars follow system scroll activity, not CSS hover state.
// Keep ScrollShadow as the viewport and draw a hover-controlled thumb over it.
export function PackageScrollArea({
  className,
  label,
  children,
}: {
  className: string
  label: string
  children: ReactNode
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; scroll: number; ratio: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [thumb, setThumb] = useState({ height: 0, top: 0, ratio: 0 })

  useEffect(() => {
    const pane = viewport.current!
    function measure() {
      const track = Math.max(0, pane.clientHeight - 8)
      const range = pane.scrollHeight - pane.clientHeight
      const height =
        range > 1
          ? Math.min(track, Math.max(28, (track * pane.clientHeight) / pane.scrollHeight))
          : 0
      const travel = track - height
      setThumb({
        height,
        top: travel > 0 ? (pane.scrollTop / range) * travel : 0,
        ratio: travel > 0 ? range / travel : 0,
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(pane)
    observer.observe(content.current!)
    pane.addEventListener('scroll', measure, { passive: true })
    measure()
    return () => {
      observer.disconnect()
      pane.removeEventListener('scroll', measure)
    }
  }, [])

  return (
    <div className={`${className} package-scroll-area${dragging ? ' is-dragging' : ''}`}>
      <ScrollShadow
        ref={viewport}
        className="package-scroll-viewport"
        hideScrollBar
        tabIndex={0}
        aria-label={label}
      >
        <div ref={content} className="package-scroll-content">
          {children}
        </div>
      </ScrollShadow>
      {thumb.height > 0 && (
        <div className="package-scroll-track" aria-hidden="true">
          <div
            className="package-scroll-thumb"
            style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.current = {
                y: event.clientY,
                scroll: viewport.current!.scrollTop,
                ratio: thumb.ratio,
              }
              setDragging(true)
            }}
            onPointerMove={(event) => {
              if (drag.current)
                viewport.current!.scrollTop =
                  drag.current.scroll + (event.clientY - drag.current.y) * drag.current.ratio
            }}
            onLostPointerCapture={() => {
              drag.current = null
              setDragging(false)
            }}
            onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
            onPointerCancel={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
          />
        </div>
      )}
    </div>
  )
}
