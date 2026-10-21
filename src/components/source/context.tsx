import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DiffLine } from '../../types'

export type SourceTab = 'changes' | 'files' | 'history'
export type SourceMode = 'view' | 'diff'

export interface SourceRequest {
  nonce: number
  tab?: SourceTab
  path?: string | null
  mode?: SourceMode
  historyPath?: string | null
  label?: string | null
  fallback?: DiffLine[]
}

interface SourceController {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  request: SourceRequest
  show: (request: Omit<SourceRequest, 'nonce'>) => void
  quickOpen: boolean
  setQuickOpen: (open: boolean) => void
}

const SourceContext = createContext<SourceController | null>(null)

export function useSource() {
  return useContext(SourceContext)
}

export function SourceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [request, setRequest] = useState<SourceRequest>({ nonce: 0 })
  const show = useCallback((next: Omit<SourceRequest, 'nonce'>) => {
    setOpen(true)
    setRequest((current) => ({ ...next, nonce: current.nonce + 1 }))
  }, [])
  const toggle = useCallback(() => setOpen((value) => !value), [])
  const value = useMemo(
    () => ({ open, setOpen, toggle, request, show, quickOpen, setQuickOpen }),
    [open, request, show, toggle, quickOpen],
  )
  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>
}
