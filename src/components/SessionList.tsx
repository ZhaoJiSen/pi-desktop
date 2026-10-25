import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { SessionSummary } from '../store/sessionSelectors'
import { SessionRow } from './SessionRow'
import type { SessionMenuTarget } from './SessionContextMenu'

export function SessionList({
  items,
  active,
  running,
  locked,
  onMenu,
  onRemove,
}: {
  items: SessionSummary[]
  active: string | null
  running: string | null
  locked: boolean
  onMenu: (target: SessionMenuTarget) => void
  onRemove: (id: string) => void
}) {
  const list = useRef<HTMLDivElement>(null)
  const [margin, setMargin] = useState(0)
  // Keep an off-screen focused/menu opener row alive so focus can return to it.
  const [focused, setFocused] = useState<string | null>(null)
  const focusedIndex = items.findIndex((item) => item.id === focused)
  // oxlint-disable-next-line react/incompatible-library -- TanStack owns viewport measurements.
  const virtual = useVirtualizer({
    count: items.length,
    getScrollElement: () => list.current?.closest<HTMLElement>('.projects') ?? null,
    estimateSize: () => 34,
    getItemKey: (index) => items[index]!.id,
    scrollMargin: margin,
    initialRect: { width: 280, height: 800 },
    overscan: 5,
    rangeExtractor: (range) => {
      const indices = defaultRangeExtractor(range)
      if (focusedIndex >= 0 && !indices.includes(focusedIndex)) indices.push(focusedIndex)
      return indices.sort((a, b) => a - b)
    },
  })
  const measurePosition = useCallback(() => {
    const element = list.current
    const parent = element?.closest<HTMLElement>('.projects')
    if (element && parent)
      setMargin(
        Math.round(
          (element.getBoundingClientRect().top -
            parent.getBoundingClientRect().top +
            parent.scrollTop) *
            100,
        ) / 100,
      )
  }, [])
  useLayoutEffect(measurePosition)
  useLayoutEffect(() => {
    const parent = list.current?.closest<HTMLElement>('.projects')
    if (!parent) return
    // Earlier groups can expand/collapse without resizing this list or the viewport.
    const observer = new ResizeObserver(measurePosition)
    observer.observe(parent)
    for (const child of parent.children) observer.observe(child)
    return () => observer.disconnect()
  }, [measurePosition])
  return (
    <div
      ref={list}
      className="virtual-session-list"
      role="list"
      style={{ height: virtual.getTotalSize() }}
      onFocusCapture={(event) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-session-index]')
        if (row) setFocused(items[Number(row.dataset.sessionIndex)]?.id ?? null)
      }}
      onKeyDownCapture={(event) => {
        if (!(event.target as HTMLElement).matches('.session') || !items.length) return
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
        const index = Number(
          (event.target as HTMLElement).closest<HTMLElement>('[data-session-index]')?.dataset
            .sessionIndex,
        )
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : Math.max(
                  0,
                  Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)),
                )
        event.preventDefault()
        event.stopPropagation()
        setFocused(items[next]!.id)
        virtual.scrollToIndex(next, { align: 'auto' })
        requestAnimationFrame(() =>
          list.current
            ?.querySelector<HTMLElement>(`[data-session-index="${next}"] .session`)
            ?.focus({ preventScroll: true }),
        )
      }}
    >
      {virtual.getVirtualItems().map((row) => {
        const session = items[row.index]!
        return (
          <div
            key={session.id}
            data-session-index={row.index}
            role="listitem"
            aria-posinset={row.index + 1}
            aria-setsize={items.length}
            style={{ position: 'absolute', top: row.start - margin, height: 32, width: '100%' }}
          >
            <SessionRow
              session={session}
              selected={active === session.id}
              locked={locked}
              removalLocked={running === session.id || (active === session.id && locked)}
              onMenu={(target) => {
                setFocused(target.id)
                onMenu(target)
              }}
              onRemove={onRemove}
            />
          </div>
        )
      })}
    </div>
  )
}
