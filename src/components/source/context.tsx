import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react'
import { navigateToPage } from '../../router/navigation'
import type { DiffLine } from '../../types'

export type SourceTab = 'changes' | 'files' | 'history'
export type SourceMode = 'view' | 'diff'

export interface SourceRequest {
  nonce: number
  projectPath?: string
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
  workspaceRequest: SourceRequest
  show: (request: Omit<SourceRequest, 'nonce'>) => void
  showWorkspace: (request?: Omit<SourceRequest, 'nonce'>) => void
  quickOpen: boolean
  setQuickOpen: (open: boolean) => void
}

// Lazy route components can retain the previous module during Fast Refresh.
// Keep one context identity so the header and mounted sidebar stay connected.
const hotData = import.meta.hot?.data as
  | { sourceContext?: Context<SourceController | null> }
  | undefined
const SourceContext = hotData?.sourceContext ?? createContext<SourceController | null>(null)
if (hotData) hotData.sourceContext = SourceContext

export function useSource() {
  return useContext(SourceContext)
}

export function SourceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [request, setRequest] = useState<SourceRequest>({ nonce: 0 })
  const [workspaceRequest, setWorkspaceRequest] = useState<SourceRequest>({ nonce: 0 })
  const show = useCallback((next: Omit<SourceRequest, 'nonce'>) => {
    if (next.tab === 'history') {
      setWorkspaceRequest((current) => ({ ...next, nonce: current.nonce + 1 }))
      void navigateToPage('git')
      return
    }
    setOpen(true)
    setRequest((current) => ({ ...next, nonce: current.nonce + 1 }))
  }, [])
  const showWorkspace = useCallback((next: Omit<SourceRequest, 'nonce'> = {}) => {
    setWorkspaceRequest((current) => ({ ...next, nonce: current.nonce + 1 }))
    void navigateToPage('git')
  }, [])
  const toggle = useCallback(() => setOpen((value) => !value), [])
  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      request,
      workspaceRequest,
      show,
      showWorkspace,
      quickOpen,
      setQuickOpen,
    }),
    [open, request, workspaceRequest, show, showWorkspace, toggle, quickOpen],
  )
  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>
}
