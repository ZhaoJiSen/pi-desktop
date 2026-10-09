import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'

export async function pickProject(): Promise<string | null> {
  if (!isDesktop) return null
  const selected = await open({ directory: true, multiple: false, title: t('projects.openFolder') })
  if (typeof selected !== 'string') return null
  const project = await invoke<{ path: string; branch: string | null }>('inspect_project', {
    path: selected,
  })
  const store = useWorkspace.getState()
  const id = store.addProject(project.path, project.branch)
  store.createSession(id)
  return id
}

export async function revealProject(path: string) {
  if (!isDesktop) throw new Error(t('errors.revealRequiresDesktop'))
  await invoke('reveal_project', { path })
}
