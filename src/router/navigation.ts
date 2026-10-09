import { router } from './index'
import { pagePaths, type Page } from './paths'
import { useWorkspace } from '../store/workspace'

export function navigateToPage(page: Page) {
  return router.navigate({ to: pagePaths[page] })
}

export function createChat(projectId: string) {
  const store = useWorkspace.getState()
  if (store.runningSessionId || store.connection === 'connecting') return null
  const id = store.createSession(projectId)
  void navigateToPage('chat')
  return id
}

export function selectChat(id: string) {
  const store = useWorkspace.getState()
  if (
    store.runningSessionId ||
    store.connection === 'connecting' ||
    !store.sessions.some((session) => session.id === id)
  )
    return false
  store.selectSession(id)
  void navigateToPage('chat')
  return true
}
