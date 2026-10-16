import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { projectPath } from '../projectPaths'

function sameDirectory(left: string, right: string) {
  return left.replace(/[\\/]+$/, '') === right.replace(/[\\/]+$/, '')
}

// The default workspace is Recent's working directory, not a folder the user added.
async function defaultDirectory(): Promise<string | null> {
  if (!isDesktop) return '~/Pi Desktop'
  const path = await invoke<unknown>('default_workspace', { create: false })
  if (typeof path !== 'string' || !path) return null
  try {
    const inspected = await invoke<{ path?: string }>('inspect_project', { path })
    return typeof inspected?.path === 'string' && inspected.path ? inspected.path : path
  } catch {
    return path
  }
}

function projectChangesLocked() {
  const state = useWorkspace.getState()
  return state.piUpdating || Boolean(state.runningSessionId) || state.connection === 'connecting'
}

export async function openProject(path: string): Promise<string | null> {
  if (projectChangesLocked()) return null
  const normalized = projectPath(path)
  if (!normalized) throw new Error(t('projects.invalidPath'))
  const project = isDesktop
    ? await invoke<{ path: string; branch: string | null }>('inspect_project', {
        path: normalized,
      })
    : { path: normalized, branch: null }
  if (projectChangesLocked()) return null
  const home = await defaultDirectory()
  if (projectChangesLocked()) return null
  const store = useWorkspace.getState()
  const id =
    home && sameDirectory(project.path, home)
      ? store.ensureRecentProject(project.path)
      : store.addProject(project.path, project.branch)
  const latest = store.sessions
    .filter((session) => session.projectId === id)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (latest) store.selectSession(latest.id)
  else store.createSession(id)
  return id
}

export async function pickProject(): Promise<string | null> {
  if (!isDesktop || projectChangesLocked()) return null
  const selected = await open({ directory: true, multiple: false, title: t('projects.openFolder') })
  if (typeof selected !== 'string') return null
  return openProject(selected)
}

export async function revealProject(path: string) {
  if (!isDesktop) throw new Error(t('errors.revealRequiresDesktop'))
  await invoke('reveal_project', { path })
}
