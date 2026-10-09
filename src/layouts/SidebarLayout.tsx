import { createContext, useContext, useState, type ReactNode } from 'react'
import { SplitPane } from '../components/SplitPane'

const DEFAULT_WIDTH = 280
const MIN_WIDTH = 270
const MAX_WIDTH = 480
const STORAGE_KEY = 'pi.sidebar-panel-width'
const SidebarWidthContext = createContext<{
  width: number
  change: (width: number) => void
  save: (width: number) => void
} | null>(null)

function readWidth() {
  try {
    for (const key of [STORAGE_KEY, 'pi.home-panel-width', 'pi.extensions-panel-width']) {
      const stored = localStorage.getItem(key)
      if (stored == null) continue
      const width = Number(stored)
      if (Number.isFinite(width) && width > 0)
        return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
    }
  } catch {
    // Use the default if browser storage is unavailable.
  }
  return DEFAULT_WIDTH
}

export function SidebarWidthProvider({ children }: { children: ReactNode }) {
  const [width, change] = useState(readWidth)
  function save(value: number) {
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // The shared in-memory width still updates when saving fails.
    }
  }
  return (
    <SidebarWidthContext.Provider value={{ width, change, save }}>
      {children}
    </SidebarWidthContext.Provider>
  )
}

interface Props {
  sidebar?: ReactNode
  children: ReactNode
  className?: string
  collapseAt: number
  label: string
  onWidthChange?: (width: number) => void
}

// Pages keep their own content while sharing one width preference and resize behavior.
export function SidebarLayout({ sidebar, children, className = '', ...resize }: Props) {
  const preference = useContext(SidebarWidthContext)
  if (!preference) throw new Error('SidebarLayout requires SidebarWidthProvider')
  return (
    <SplitPane
      {...resize}
      preferredWidth={preference.width}
      onPreferredWidthChange={preference.change}
      onResizeEnd={preference.save}
      defaultWidth={DEFAULT_WIDTH}
      minWidth={MIN_WIDTH}
      maxWidth={MAX_WIDTH}
      minContentWidth={360}
      className={`sidebar-layout ${sidebar ? 'has-sidebar' : ''} ${className}`}
      enabled={Boolean(sidebar)}
    >
      {sidebar}
      {children}
    </SplitPane>
  )
}
