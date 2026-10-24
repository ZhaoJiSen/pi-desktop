import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { gitStatus } from '../../lib/source/api'
import type { GitStatus } from '../../lib/source/types'
import { useSourceQuery, type SourceQuery } from './useSourceQuery'

const RepositoryStatusContext = createContext<{
  status: SourceQuery<GitStatus>
  refresh: () => void
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
  const status = useSourceQuery(
    projectPath ? `status:${projectPath}` : null,
    () => gitStatus(projectPath),
    `${revision}:${tick}:${generation}`,
  )
  const refresh = useCallback(() => {
    if (onChanged) onChanged()
    else setGeneration((value) => value + 1)
  }, [onChanged])
  const { loading, data, error } = status
  const value = useMemo(
    () => ({ status: { loading, data, error }, refresh }),
    [loading, data, error, refresh],
  )
  return (
    <RepositoryStatusContext.Provider value={value}>{children}</RepositoryStatusContext.Provider>
  )
}

export function useGitRepositoryStatus() {
  return useContext(RepositoryStatusContext)
}
