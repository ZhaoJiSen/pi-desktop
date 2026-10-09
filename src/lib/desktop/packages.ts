import { invoke } from '@tauri-apps/api/core'
import type { ExtensionPackage } from '../../types'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { runtimeState } from './runtimeState'

// Keep metadata and cached project connections consistent after package changes.
export async function refreshExtensionPackages(path: string) {
  if (!isDesktop) throw new Error(t('packages.desktopOnly'))
  const packages = await invoke<ExtensionPackage[]>('extension_packages', { path })
  const cached = runtimeState.projectConnections.get(path)
  if (cached) cached.packages = packages
  if (runtimeState.currentRun?.path === path) runtimeState.currentRun.packages = packages
  const store = useWorkspace.getState()
  const active = store.sessions.find((session) => session.id === store.activeSessionId)
  if (store.projects.find((project) => project.id === active?.projectId)?.path === path) {
    useWorkspace.setState({ packages })
  }
  return packages
}
