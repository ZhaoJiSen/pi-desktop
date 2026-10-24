import { createContext, useContext } from 'react'
export const GitOperationContext = createContext(false)
export function useGitOperationPending() {
  return useContext(GitOperationContext)
}
