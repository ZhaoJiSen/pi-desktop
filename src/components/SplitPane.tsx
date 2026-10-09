import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useT } from '../lib/i18n'

interface Props {
  children: ReactNode
  className: string
  preferredWidth: number
  onPreferredWidthChange: (width: number) => void
  onResizeEnd: (width: number) => void
  defaultWidth: number
  minWidth: number
  minContentWidth: number
  maxWidth?: number
  collapseAt: number
  enabled?: boolean
  label: string
  onWidthChange?: (width: number) => void
}

// HeroUI has no general split-pane component. Keep resizing in one shared shell.
export function SplitPane({
  children,
  className,
  preferredWidth,
  onPreferredWidthChange,
  onResizeEnd,
  defaultWidth,
  minWidth,
  minContentWidth,
  maxWidth = 480,
  collapseAt,
  enabled = true,
  label,
  onWidthChange,
}: Props) {
  const t = useT()
  const container = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; x: number; width: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [availableWidth, setAvailableWidth] = useState<number | null>(null)
  const [narrow, setNarrow] = useState(() => matchMedia(`(max-width: ${collapseAt}px)`).matches)
  const active = enabled && !narrow
  const maximum = Math.max(
    minWidth,
    Math.min(maxWidth, availableWidth == null ? maxWidth : availableWidth - minContentWidth),
  )
  const clamp = (width: number) => Math.round(Math.max(minWidth, Math.min(maximum, width)))
  const width = clamp(preferredWidth)

  useEffect(() => {
    const media = matchMedia(`(max-width: ${collapseAt}px)`)
    const update = () => setNarrow(media.matches)
    media.addEventListener('change', update)
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width))
    observer.observe(container.current!)
    return () => {
      media.removeEventListener('change', update)
      observer.disconnect()
    }
  }, [collapseAt])
  useEffect(() => {
    if (active) onWidthChange?.(width)
  }, [active, width, onWidthChange])

  return (
    <div
      ref={container}
      className={`split-pane ${className}`}
      data-split-active={active || undefined}
      data-resizing={(active && dragging) || undefined}
      style={
        active
          ? ({
              '--split-width': `${width}px`,
              gridTemplateColumns: 'var(--split-width) minmax(0, 1fr)',
            } as CSSProperties)
          : undefined
      }
    >
      {children}
      {active && (
        <div
          className="split-pane-handle"
          role="separator"
          tabIndex={0}
          aria-label={label}
          aria-orientation="vertical"
          aria-valuemin={minWidth}
          aria-valuemax={maximum}
          aria-valuenow={width}
          aria-valuetext={t('layout.width', { width })}
          data-tauri-drag-region="false"
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            event.currentTarget.focus()
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { pointer: event.pointerId, x: event.clientX, width }
            setDragging(true)
          }}
          onPointerMove={(event) => {
            const start = drag.current
            if (start?.pointer !== event.pointerId) return
            onPreferredWidthChange(clamp(start.width + event.clientX - start.x))
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointer !== event.pointerId) return
            const next = clamp(drag.current.width + event.clientX - drag.current.x)
            onPreferredWidthChange(next)
            onResizeEnd(next)
            drag.current = null
            setDragging(false)
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onLostPointerCapture={() => {
            drag.current = null
            setDragging(false)
          }}
          onPointerCancel={() => {
            drag.current = null
            setDragging(false)
          }}
          onDoubleClick={() => {
            onPreferredWidthChange(defaultWidth)
            onResizeEnd(defaultWidth)
          }}
          onKeyDown={(event) => {
            let next: number
            const step = event.shiftKey ? 40 : 10
            switch (event.key) {
              case 'ArrowLeft':
                next = width - step
                break
              case 'ArrowRight':
                next = width + step
                break
              case 'Home':
                next = minWidth
                break
              case 'End':
                next = maximum
                break
              default:
                return
            }
            event.preventDefault()
            next = clamp(next)
            onPreferredWidthChange(next)
            onResizeEnd(next)
          }}
        />
      )}
    </div>
  )
}
