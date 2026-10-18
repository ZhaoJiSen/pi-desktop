import { router } from './index'
import { pagePaths, type Page } from './paths'
import { useWorkspace, type SettingsSectionId } from '../store/workspace'

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

export function navigateToSettings(section: SettingsSectionId) {
  if (section === 'capabilities') return navigateToCapabilities()
  useWorkspace.setState({ settingsSection: section })
  return navigateToPage('settings')
}

export function navigateToCapabilities(
  id: string | null = null,
  target?: import('../lib/capabilities/types').Capability['target'],
) {
  useWorkspace.setState({
    commandCapabilityId: target ? `${target.source}:${target.name}:${target.origin}` : id,
  })
  return navigateToPage('commands')
}

export function navigateToExtensionSource(item?: import('../types').ExtensionPackage) {
  useWorkspace.setState({
    extensionSelection: {
      key: item ? `${item.scope}:${item.source}` : null,
      category: item ? '' : 'skill',
    },
  })
  return navigateToPage('extensions')
}
