import { createContext, useContext } from 'react'

export const WorkspaceActionsContext = createContext<{ onProject: () => void } | null>(null)

export function useWorkspaceActions() {
  const actions = useContext(WorkspaceActionsContext)
  if (!actions) throw new Error('Workspace actions require WorkspaceLayout')
  return actions
}
