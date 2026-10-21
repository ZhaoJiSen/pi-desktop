import { useEffect, useRef } from 'react'
import { useT } from '../../lib/i18n'

export function PanelResize({
  width,
  maxWidth,
  onWidth,
  onDrag,
  onReset,
}: {
  width: number
  maxWidth: number
  onWidth: (next: number, shrinking?: boolean) => void
  onDrag: (active: boolean) => void
  onReset?: () => void
}) {
  const t = useT()
  const cleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanup.current?.(), [])

  return (
    <div
      className="source-resize"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={t('source.resize')}
      aria-valuemin={Math.min(320, maxWidth)}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 40 : 10
        let next: number
        switch (event.key) {
          case 'ArrowRight':
            next = width - step
            break
          case 'ArrowLeft':
            next = width + step
            break
          case 'Home':
            next = Math.min(320, maxWidth)
            break
          case 'End':
            next = maxWidth
            break
          default:
            return
        }
        event.preventDefault()
        onWidth(Math.min(maxWidth, Math.max(Math.min(320, maxWidth), next)))
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || cleanup.current) return
        event.preventDefault()
        const handle = event.currentTarget
        const pointer = event.pointerId
        const startX = event.clientX
        let previousX = startX
        const start = width
        handle.setPointerCapture(pointer)
        window.getSelection()?.removeAllRanges()
        document.documentElement.classList.add('source-panel-resizing')
        onDrag(true)

        const move = (ev: PointerEvent) => {
          if (ev.pointerId !== pointer) return
          ev.preventDefault()
          onWidth(
            Math.min(maxWidth, Math.max(Math.min(320, maxWidth), start + startX - ev.clientX)),
            ev.clientX > previousX,
          )
          previousX = ev.clientX
        }
        const stop = () => {
          cleanup.current = null
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', end)
          window.removeEventListener('pointercancel', end)
          window.removeEventListener('blur', stop)
          handle.removeEventListener('lostpointercapture', end)
          document.documentElement.classList.remove('source-panel-resizing')
          if (handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer)
          onDrag(false)
        }
        const end = (ev: PointerEvent) => {
          if (ev.pointerId === pointer) stop()
        }
        cleanup.current = stop
        window.addEventListener('pointermove', move, { passive: false })
        window.addEventListener('pointerup', end)
        window.addEventListener('pointercancel', end)
        window.addEventListener('blur', stop)
        handle.addEventListener('lostpointercapture', end)
      }}
    />
  )
}
