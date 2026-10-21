import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { agentTouchedPaths } from '../../lib/source/paths'
import { useWorkspace } from '../../store/workspace'

export function useProjectSource() {
  const snapshot = useWorkspace(
    useShallow((state) => {
      const session = state.sessions.find((item) => item.id === state.activeSessionId)
      const project = state.projects.find((item) => item.id === session?.projectId)
      let revision = 0
      for (const message of session?.messages ?? []) {
        for (const block of message.blocks) {
          if (block.type === 'tool' && block.status !== 'running') revision += 1
        }
      }
      return {
        path: project?.path ?? '',
        name: project?.name ?? '',
        revision,
        messages: session?.messages,
      }
    }),
  )
  const agent = useMemo(
    () => agentTouchedPaths(snapshot.messages ?? [], snapshot.path),
    [snapshot.messages, snapshot.path],
  )
  return { path: snapshot.path, name: snapshot.name, revision: snapshot.revision, agent }
}
