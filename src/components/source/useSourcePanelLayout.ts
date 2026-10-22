import { useLayoutEffect, useRef, useState } from 'react'

const WIDTH_KEY = 'pi.source-panel-width'
const SPLIT_WIDTH_KEY = 'pi.source-panel-split-width'
const DEFAULT_WIDTH = 760
const MIN_PANEL_WIDTH = 320
const MIN_CHAT_WIDTH = 320
type WidthPreference = number | 'expanded'

function readWidth(key = WIDTH_KEY): WidthPreference {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'expanded') return stored
    const width = stored === null ? DEFAULT_WIDTH : Number(stored)
    return Number.isFinite(width) && width > 0 ? Math.max(MIN_PANEL_WIDTH, width) : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

export function useSourcePanelLayout(open: boolean) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [preference, setPreference] = useState(readWidth)
  const currentPreference = useRef(preference)
  const [lastSplit, setLastSplit] = useState(() => {
    if (typeof preference === 'number') return preference
    const saved = readWidth(SPLIT_WIDTH_KEY)
    return typeof saved === 'number' ? saved : DEFAULT_WIDTH
  })
  const [available, setAvailable] = useState(0)

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => setAvailable(Math.max(0, Math.floor(stage.getBoundingClientRect().width)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const requested = preference === 'expanded' ? available : Math.min(preference, available)
  const fillsStage = available > 0 && available - requested < MIN_CHAT_WIDTH
  const width = fillsStage ? available : requested
  const canSplit = available >= MIN_PANEL_WIDTH + MIN_CHAT_WIDTH

  function onWidth(next: number, shrinking = next < width) {
    // A full-width panel must react to a short drag back. Otherwise the first
    // 320px of movement keep snapping to full width and feel completely stuck.
    const current = currentPreference.current
    const wasFull =
      current === 'expanded' || available - Math.min(current, available) < MIN_CHAT_WIDTH
    const returning = wasFull && canSplit && shrinking && available - next >= 8
    const target = returning ? Math.min(next, available - MIN_CHAT_WIDTH) : next
    const clamped = Math.min(available, Math.max(Math.min(MIN_PANEL_WIDTH, available), target))
    const value: WidthPreference = available - clamped < MIN_CHAT_WIDTH ? 'expanded' : clamped
    currentPreference.current = value
    setPreference(value)
    if (typeof value === 'number') setLastSplit(value)
    try {
      localStorage.setItem(WIDTH_KEY, String(value))
      if (typeof value === 'number') localStorage.setItem(SPLIT_WIDTH_KEY, String(value))
    } catch {
      // Resizing remains available when saving a preference is unavailable.
    }
  }

  function restore() {
    onWidth(Math.min(lastSplit, available - MIN_CHAT_WIDTH))
  }

  return {
    stageRef,
    width,
    maxWidth: available,
    expanded: open && fillsStage,
    canSplit,
    onWidth,
    restore,
  }
}
