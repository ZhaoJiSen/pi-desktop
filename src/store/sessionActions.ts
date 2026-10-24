import type { StoreApi } from 'zustand'
import { draftText, normalizeDraft } from '../lib/draft'
import { makeSession } from '../lib/fixtures'
import { applyStreamEvent } from '../lib/rpc'
import type { WorkspaceState } from './workspaceTypes'
export function sessionActions(
  set: StoreApi<WorkspaceState>['setState'],
  get: StoreApi<WorkspaceState>['getState'],
  setStreamingWrite: (value: boolean) => void,
): Pick<
  WorkspaceState,
  | 'createSession'
  | 'selectSession'
  | 'togglePinSession'
  | 'removeSession'
  | 'updateSession'
  | 'appendEvent'
  | 'rememberModel'
> {
  return {
    createSession: (projectId) => {
      const session = makeSession(projectId)
      const previous = get().sessions.find((item) => item.id === get().activeSessionId)
      session.modelKey = previous?.modelKey || get().recentModels[0] || ''
      session.thinking = previous?.thinking || 'medium'
      set((state) => ({
        sessions: [session, ...state.sessions],
        activeSessionId: session.id,
        projects: state.projects.map((project) =>
          project.id === projectId ? { ...project, collapsed: false, hidden: false } : project,
        ),
      }))
      return session.id
    },
    selectSession: (id) => {
      const state = get()
      const session = state.sessions.find((session) => session.id === id)
      if (session && !state.runningSessionId && state.connection !== 'connecting')
        set({
          activeSessionId: id,
          connectionError: null,
          projects: state.projects.map((project) =>
            project.id === session.projectId ? { ...project, hidden: false } : project,
          ),
        })
    },
    togglePinSession: (id) =>
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === id ? { ...session, pinned: !session.pinned } : session,
        ),
      })),
    removeSession: (id) => {
      const state = get()
      const removed = state.sessions.find((session) => session.id === id)
      if (
        !removed ||
        state.runningSessionId === id ||
        (state.activeSessionId === id &&
          (state.runningSessionId || state.connection === 'connecting'))
      )
        return false
      const sessions = state.sessions.filter((session) => session.id !== id)
      if (state.activeSessionId !== id) {
        set({ sessions })
        return true
      }
      const ordered = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
      const next = ordered.find((session) => session.projectId === removed.projectId) || ordered[0]
      set({
        sessions,
        activeSessionId: next?.id || null,
        connection: 'disconnected',
        connectionError: null,
        commands: [],
        packages: [],
      })
      return true
    },
    updateSession: (id, patch) =>
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === id
            ? {
                ...session,
                ...patch,
                ...(patch.draftNodes !== undefined
                  ? {
                      draftNodes: normalizeDraft(patch.draftNodes),
                      draft: draftText(patch.draftNodes),
                    }
                  : 'draft' in patch
                    ? { draftNodes: undefined }
                    : {}),
              }
            : session,
        ),
      })),
    appendEvent: (id, event) => {
      const state = get()
      const index = state.sessions.findIndex((session) => session.id === id)
      if (index < 0) return
      const session = state.sessions[index]
      const messages = applyStreamEvent(session.messages, event)
      if (messages === session.messages) return
      const sessions = state.sessions.slice()
      sessions[index] = { ...session, messages }
      setStreamingWrite(event.type === 'message_update' || event.type === 'tool_execution_update')
      try {
        set({ sessions })
      } finally {
        setStreamingWrite(false)
      }
    },
    rememberModel: (key) =>
      set((state) => ({
        recentModels: [key, ...state.recentModels.filter((item) => item !== key)].slice(0, 8),
      })),
  }
}
