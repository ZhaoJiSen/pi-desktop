import { invoke } from '@tauri-apps/api/core'
import { isDesktop, useWorkspace } from '../store/workspace'
import { t } from './i18n'
import { isRecentProject } from './recentProject'
import type { Project } from '../types'

export async function openRecentProject(): Promise<string> {
  if (!isDesktop) return useWorkspace.getState().ensureRecentProject('~/Pi Desktop')
  const created = await invoke<string>('default_workspace', { create: true })
  const inspected = await invoke<{ path: string }>('inspect_project', { path: created })
  return useWorkspace.getState().ensureRecentProject(inspected.path)
}

export function projectTitle(project: Pick<Project, 'id' | 'name' | 'builtin'>): string {
  return isRecentProject(project) ? t('projects.recentChats') : project.name
}
