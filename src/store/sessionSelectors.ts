import { useShallow } from 'zustand/react/shallow'
import { shallow } from 'zustand/vanilla/shallow'
import type { Session } from '../types'
import { useWorkspace } from './workspace'

export type SessionSummary = Pick<Session, 'id' | 'projectId' | 'title' | 'updatedAt' | 'pinned'>
let source: Session[] | undefined
let summaries: SessionSummary[] = []

// Sidebar subscriptions must not depend on drafts, tokens or tool output.
export function selectSessionSummaries(state: { sessions: Session[] }): SessionSummary[] {
  if (source === state.sessions) return summaries
  source = state.sessions
  const previous = new Map(summaries.map((item) => [item.id, item]))
  const next = source.map(({ id, projectId, title, updatedAt, pinned }) => {
    const item = { id, projectId, title, updatedAt, pinned }
    const old = previous.get(id)
    return old && shallow(old, item) ? old : item
  })
  if (!shallow(summaries, next)) summaries = next
  return summaries
}

// Input controls need session settings and drafts, never the message payload.
export function useSessionDetails() {
  return useWorkspace(
    useShallow((state) => {
      const session = state.sessions.find((item) => item.id === state.activeSessionId)
      if (!session) return undefined
      const { messages, ...details } = session
      return { ...details, hasMessages: messages.length > 0 }
    }),
  )
}
