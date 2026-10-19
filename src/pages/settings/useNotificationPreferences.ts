import { create } from 'zustand'
import { useWorkspace } from '../../store/workspace'
import type { NotificationPreferences } from '../../lib/notificationPreferences'

const useDraft = create<{
  draft: NotificationPreferences | null
  error: string
  saving: boolean
}>(() => ({ draft: null, error: '', saving: false }))
let flushing = false

async function flush() {
  if (flushing) return
  flushing = true
  try {
    while (useDraft.getState().draft) {
      const next = useDraft.getState().draft!
      const previous = useWorkspace.getState().notificationPreferences
      useDraft.setState({ saving: true, error: '' })
      useWorkspace.setState({ storageError: null })
      useWorkspace.getState().setPreference({ notificationPreferences: next })
      await useWorkspace.flushPersistence()
      await Promise.resolve()
      const error = useWorkspace.getState().storageError
      if (error) {
        useWorkspace.setState({ notificationPreferences: previous })
        useDraft.setState({ saving: false, error })
        break
      }
      useDraft.setState({
        saving: false,
        ...(useDraft.getState().draft === next ? { draft: null } : {}),
      })
    }
  } finally {
    flushing = false
  }
}

export function useNotificationPreferences() {
  const saved = useWorkspace((state) => state.notificationPreferences)
  const state = useDraft()
  return {
    ...state,
    preferences: state.draft || saved,
    change: (patch: Partial<NotificationPreferences>) => {
      useDraft.setState({
        draft: {
          ...(useDraft.getState().draft || useWorkspace.getState().notificationPreferences),
          ...patch,
        },
      })
      void flush()
    },
    retry: () => void flush(),
  }
}
