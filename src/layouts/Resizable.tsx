import {
  Children,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useT } from '../lib/i18n'

// A drag used to pin these inline. Clear them so a reload cannot keep a pane
// wider than the window.
function clearContentLocks(group: HTMLElement | null) {
  group?.querySelectorAll<HTMLElement>('.resizable-panel, .resizable-panel > *').forEach((node) => {
    node.style.removeProperty('width')
    node.style.removeProperty('min-width')
    node.style.removeProperty('max-width')
  })
}

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
  collapsible?: boolean
  open?: boolean
  label: string
  onWidthChange?: (width: number) => void
}

// Two flex items and a zero-width handle. The side panel's flex-basis is the
// width, so the handle stays on the boundary without a separate position.
export function Resizable({
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
  collapsible = false,
  open = true,
  label,
  onWidthChange,
}: Props) {
  const t = useT()
  const container = useRef<HTMLDivElement>(null)
  const sideRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; x: number; width: number } | null>(null)
  const live = useRef<number | null>(null)
  const frame = useRef<number | null>(null)
  const pendingSeparator = useRef<HTMLElement | null>(null)
  const chromeOverride = useRef(false)
  const [availableWidth, setAvailableWidth] = useState<number | null>(null)
  const [narrow, setNarrow] = useState(() => matchMedia(`(max-width: ${collapseAt}px)`).matches)
  const active = enabled && !narrow && open
  const clip = collapsible && enabled && !narrow
  const maximum = Math.max(
    minWidth,
    Math.min(maxWidth, availableWidth == null ? maxWidth : availableWidth - minContentWidth),
  )
  const clamp = (width: number) => Math.round(Math.max(minWidth, Math.min(maximum, width)))
  const width = clamp(preferredWidth)
  const basis = clip && !open ? '0px' : `${width}px`
  const sideStyle = {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: basis,
    '--panel-open': `${width}px`,
  } as CSSProperties

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
  // The drag writes the header width onto the chrome itself. Drop that override
  // once React has committed the same width on the shell.
  useLayoutEffect(() => {
    if (!chromeOverride.current) return
    chromeOverride.current = false
    container.current
      ?.closest<HTMLElement>('.app-shell')
      ?.querySelector<HTMLElement>('.window-chrome')
      ?.style.removeProperty('--sidebar-width')
  }, [width])
  useEffect(() => {
    const group = container.current
    clearContentLocks(group)
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
      group?.removeAttribute('data-resizing')
      clearContentLocks(group)
      const shell = group?.closest<HTMLElement>('.app-shell')
      shell?.removeAttribute('data-resizing')
      shell?.querySelector<HTMLElement>('.window-chrome')?.style.removeProperty('--sidebar-width')
    }
  }, [])
  useEffect(() => {
    if (open || narrow) return
    const side = sideRef.current
    if (side?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur()
  }, [open, narrow])

  const nodes = Children.toArray(children)
  const hideSide = collapsible && enabled && !open && narrow
  const split = clip || active
  const sideNode = hideSide ? null : nodes[0]
  const mainNodes = nodes.slice(1)

  function paint(next: number, separator: HTMLElement) {
    const side = sideRef.current
    if (side) {
      // Width and max-width keep the session list from stretching the pane.
      side.style.flexBasis = `${next}px`
      side.style.width = `${next}px`
      side.style.maxWidth = `${next}px`
      side.style.minWidth = '0'
      // The clipped content needs the live width too; otherwise only the pane
      // boundary moves and its contents stay at the pre-drag width until release.
      if (clip) side.style.setProperty('--panel-open', `${next}px`)
    }
    // Keep this off the shell during the gesture. Inherited custom properties
    // would restyle the whole conversation on every frame.
    if (onWidthChange) {
      container.current
        ?.closest<HTMLElement>('.app-shell')
        ?.querySelector<HTMLElement>('.window-chrome')
        ?.style.setProperty('--sidebar-width', `${next}px`)
      chromeOverride.current = true
    }
    separator.setAttribute('aria-valuenow', String(next))
    separator.setAttribute('aria-valuetext', t('layout.width', { width: next }))
  }
  function finish(next: number, save: boolean) {
    if (frame.current != null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    const separator = pendingSeparator.current
    if (separator) paint(next, separator)
    const group = container.current
    clearContentLocks(group)
    group?.removeAttribute('data-resizing')
    group?.closest('.app-shell')?.removeAttribute('data-resizing')
    drag.current = null
    live.current = null
    pendingSeparator.current = null
    onPreferredWidthChange(next)
    onWidthChange?.(next)
    if (save) onResizeEnd(next)
  }

  return (
    <div
      ref={container}
      className={`resizable ${className}`}
      data-orientation="horizontal"
      data-split={split || undefined}
      data-split-active={active || undefined}
      data-collapsible={clip || undefined}
    >
      {split ? (
        <>
          <div
            ref={sideRef}
            className="resizable-panel resizable-panel-side"
            data-panel="side"
            inert={clip && !open ? true : undefined}
            aria-hidden={clip && !open ? true : undefined}
            style={sideStyle}
          >
            {clip ? <div className="resizable-panel-fixed">{sideNode}</div> : sideNode}
          </div>
          {active && (
            <div
              className="resizable-handle"
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
                live.current = null
                const group = container.current
                group?.setAttribute('data-resizing', 'true')
                group?.closest('.app-shell')?.setAttribute('data-resizing', 'true')
              }}
              onPointerMove={(event) => {
                const start = drag.current
                if (start?.pointer !== event.pointerId) return
                const next = clamp(start.width + event.clientX - start.x)
                live.current = next
                pendingSeparator.current = event.currentTarget
                if (frame.current != null) return
                frame.current = requestAnimationFrame(() => {
                  frame.current = null
                  const nextWidth = live.current
                  const separator = pendingSeparator.current
                  if (nextWidth == null || !separator || !drag.current) return
                  paint(nextWidth, separator)
                })
              }}
              onPointerUp={(event) => {
                if (drag.current?.pointer !== event.pointerId) return
                const next = clamp(drag.current.width + event.clientX - drag.current.x)
                pendingSeparator.current = event.currentTarget
                finish(next, true)
                event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              onLostPointerCapture={() => {
                const current = drag.current
                if (!current) return
                finish(live.current ?? current.width, false)
              }}
              onPointerCancel={() => {
                const current = drag.current
                if (!current) return
                finish(live.current ?? current.width, false)
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
          <div
            ref={mainRef}
            className="resizable-panel resizable-panel-main"
            data-panel="main"
            style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0px' }}
          >
            {mainNodes}
          </div>
        </>
      ) : hideSide ? (
        mainNodes
      ) : (
        children
      )}
    </div>
  )
}
