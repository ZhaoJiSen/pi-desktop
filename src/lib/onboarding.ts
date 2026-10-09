import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { isDesktop, useWorkspace } from '../store/workspace'
import { t } from './i18n'

export interface PiEnvironment {
  executable: string
  version: string
  nodeVersion: string | null
  defaultWorkspace: string
}
export interface OnboardingProject {
  path: string
  branch: string | null
}

export async function checkPiEnvironment(executable: string): Promise<PiEnvironment> {
  if (!isDesktop) throw new Error(t('onboarding.desktopOnly'))
  await invoke('set_app_language', { language: useWorkspace.getState().language })
  return invoke('check_pi_environment', { executable: executable.trim() || 'pi' })
}

export async function chooseOnboardingProject(): Promise<OnboardingProject | null> {
  if (!isDesktop) return null
  const selected = await open({ directory: true, multiple: false, title: t('projects.openFolder') })
  if (typeof selected !== 'string') return null
  return invoke('inspect_project', { path: selected })
}

export async function onboardingDefaultPath(): Promise<string> {
  if (!isDesktop) return '~/Pi Desktop'
  return invoke('default_workspace', { create: false })
}

// Nothing is added to the store until folder preparation succeeds. Re-entering
// the guide reuses a project's existing session rather than creating duplicates.
export async function prepareOnboardingWorkspace(project: OnboardingProject | null) {
  if (!isDesktop) return
  const path = project?.path ?? (await invoke<string>('default_workspace', { create: true }))
  const inspected = await invoke<OnboardingProject>('inspect_project', { path })
  const store = useWorkspace.getState()
  const projectId = store.addProject(inspected.path, inspected.branch)
  const existing = store.sessions.find((session) => session.projectId === projectId)
  if (existing) store.selectSession(existing.id)
  else store.createSession(projectId)
}
