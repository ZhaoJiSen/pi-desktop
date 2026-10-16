import { Channel, invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { isDesktop, useWorkspace } from '../store/workspace'
import { t } from './i18n'
import { openRecentProject } from './recent'

export interface PiEnvironment {
  executable: string
  version: string
  nodeVersion: string | null
  defaultWorkspace: string
}
export interface PiDiagnosis {
  kind: 'ready' | 'missing' | 'pathProblem' | 'runtimeError' | 'incompatible' | 'rpcError'
  environment: PiEnvironment | null
  compatibility: 'verified' | 'unverified' | 'unsupported' | 'unknown'
  authentication: 'ready' | 'missing' | 'unknown'
  pathRecovered: boolean
  discoveredExecutable: string | null
  detail: string | null
  canRepair: boolean
}
export interface PiInstallPlan {
  id: string
  command: string
  source: string
  version: string
  directory: string
  nodeVersion: string
}
export interface PiInstallProgress {
  stage: 'installing' | 'verifying'
  stream: 'stdout' | 'stderr' | null
  text: string | null
}

export async function inspectPiEnvironment(executable: string): Promise<PiDiagnosis> {
  if (!isDesktop) throw new Error(t('onboarding.desktopOnly'))
  await invoke('set_app_language', { language: useWorkspace.getState().language })
  return invoke('inspect_pi_environment', { executable: executable.trim() || 'pi' })
}

export async function preparePiInstall(executable: string): Promise<PiInstallPlan> {
  if (!isDesktop) throw new Error(t('onboarding.desktopOnly'))
  await invoke('set_app_language', { language: useWorkspace.getState().language })
  return invoke('prepare_pi_install', { executable: executable.trim() || 'pi' })
}

export async function installPi(
  planId: string,
  progress: (event: PiInstallProgress) => void,
): Promise<PiDiagnosis> {
  if (!isDesktop) throw new Error(t('onboarding.desktopOnly'))
  const state = useWorkspace.getState()
  if (
    state.piUpdating ||
    state.runningSessionId ||
    state.piBusyRuns.length ||
    state.connection === 'connecting'
  )
    throw new Error(t('piUpdate.busy'))
  // Set synchronously so another click cannot enter before the native guard.
  useWorkspace.setState({ piUpdating: true })
  try {
    const channel = new Channel<PiInstallProgress>()
    channel.onmessage = progress
    return await invoke('install_pi', { planId, confirmed: true, onProgress: channel })
  } finally {
    useWorkspace.setState({ piUpdating: false })
  }
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
  let projectId: string
  if (!project) projectId = await openRecentProject()
  else {
    const inspected = await invoke<OnboardingProject>('inspect_project', { path: project.path })
    projectId = useWorkspace.getState().addProject(inspected.path, inspected.branch)
  }
  const store = useWorkspace.getState()
  const existing = store.sessions.find((session) => session.projectId === projectId)
  if (existing) store.selectSession(existing.id)
  else store.createSession(projectId)
}
