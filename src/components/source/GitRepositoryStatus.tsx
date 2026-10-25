import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { GitStatus } from '../../lib/source/types'
import { type SourceQuery } from './useSourceQuery'
import { useGitStatus } from './useGitStatus'

const RepositoryStatusContext = createContext<{
  status: SourceQuery<GitStatus>
  refresh: () => void
  revision: number
} | null>(null)

/** One repository status feeds both navigation badges and the Changes contents. */
export function GitRepositoryStatusProvider({
  projectPath,
  revision,
  tick,
  onChanged,
  children,
}: {
  projectPath: string
  revision: number
  tick: number
  onChanged?: () => void
  children: ReactNode
}) {
  const [generation, setGeneration] = useState(0)
  const status = useGitStatus(projectPath || null, `${revision}:${tick}:${generation}`)
  const refresh = useCallback(() => {
    if (onChanged) onChanged()
    else setGeneration((value) => value + 1)
  }, [onChanged])
  const { loading, data, error } = status
  const contentRevision = generation + status.revision
  const value = useMemo(
    () => ({ status: { loading, data, error }, refresh, revision: contentRevision }),
    [loading, data, error, refresh, contentRevision],
  )
  return (
    <RepositoryStatusContext.Provider value={value}>{children}</RepositoryStatusContext.Provider>
  )
}

export function useGitRepositoryStatus() {
  return useContext(RepositoryStatusContext)
}
