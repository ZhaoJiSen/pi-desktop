import { useId, useLayoutEffect } from 'react'
import { create } from 'zustand'
import { useWorkspace } from '../../store/workspace'

interface CountSnapshot {
  scope: string
  owner: string | null
  filtered: number
  total: number
}

// Transient header data survives the library unmounting, never workspace persistence.
export const commandHeaderCount = create<{ snapshot: CountSnapshot | null }>(() => ({
  snapshot: null,
}))

function useCountScope() {
  return useWorkspace((s) =>
    JSON.stringify([s.activeSessionId, s.piExecutable, s.language, s.connection]),
  )
}

export function useCommandHeaderCount() {
  const scope = useCountScope()
  return commandHeaderCount((s) => {
    const value = s.snapshot
    if (!value || value.scope !== scope) return '—'
    return value.filtered === value.total
      ? String(value.total)
      : `${value.filtered} / ${value.total}`
  })
}

export function usePublishCommandCount(filtered: number, total: number, loading: boolean) {
  const scope = useCountScope()
  const owner = useId()
  useLayoutEffect(() => {
    if (loading) return
    const current = commandHeaderCount.getState().snapshot
    if (
      current?.scope === scope &&
      current.owner === owner &&
      current.filtered === filtered &&
      current.total === total
    )
      return
    commandHeaderCount.setState({ snapshot: { scope, owner, filtered, total } })
  }, [filtered, total, loading, scope, owner])
  useLayoutEffect(
    () => () => {
      const current = commandHeaderCount.getState().snapshot
      if (current?.scope !== scope || current.owner !== owner) return
      // A new visit starts with the full list, rather than the previous search count.
      commandHeaderCount.setState({
        snapshot: { ...current, owner: null, filtered: current.total },
      })
    },
    [scope, owner],
  )
}
