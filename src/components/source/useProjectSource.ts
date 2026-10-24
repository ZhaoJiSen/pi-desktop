import { createContext, useContext, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { agentTouchedPaths, sourceRevision } from '../../lib/source/paths'
import { useWorkspace } from '../../store/workspace'

export const ProjectSourceContext = createContext<{ path: string; name: string } | null>(null)

export function useProjectSource() {
  const override = useContext(ProjectSourceContext)
  const snapshot = useWorkspace(
    useShallow((state) => {
      const session = state.sessions.find((item) => item.id === state.activeSessionId)
      const project = state.projects.find((item) => item.id === session?.projectId)
      return {
        path: project?.path ?? '',
        name: project?.name ?? '',
        revision: sourceRevision(session?.messages ?? []),
        messages: session?.messages,
      }
    }),
  )
  const agent = useMemo(
    () => agentTouchedPaths(snapshot.messages ?? [], snapshot.path),
    [snapshot.messages, snapshot.path],
  )
  return {
    path: override?.path ?? snapshot.path,
    name: override?.name ?? snapshot.name,
    revision: snapshot.revision,
    agent: override && override.path !== snapshot.path ? new Set<string>() : agent,
  }
}
