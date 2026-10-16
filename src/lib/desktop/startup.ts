import { Channel, invoke } from '@tauri-apps/api/core'
import type { ExtensionPackage, Project, RpcState, RuntimeEvent } from '../../types'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { reportActionNotice } from '../notices'
import { projectTitle } from '../recent'
import { errorText } from '../utils'
import { handleEvent } from './events'
import { activateSession, warmProject } from './connections'
import { runtimeState, type PiConnection } from './runtimeState'

// Rust localizes this before the process starts. A deleted folder belongs to
// that project; it must not keep the rest of the app on the startup screen.
function isClosedProjectDirectory(message: string | null | undefined) {
  if (!message) return false
  return (
    message.includes('Could not open the project directory') || message.includes('无法打开项目目录')
  )
}

function noteClosedProject(project: Pick<Project, 'id' | 'name' | 'builtin'>, message: string) {
  reportActionNotice(`${projectTitle(project)}: ${message}`)
}

export async function syncDesktopLanguage() {
  if (isDesktop) await invoke('set_app_language', { language: useWorkspace.getState().language })
}

export async function initializeLanguage() {
  if (!isDesktop) return
  const locale = await invoke<string>('system_locale')
  useWorkspace.getState().applySystemLocale(locale)
  await syncDesktopLanguage()
}

export function initializeDesktop(): Promise<void> {
  if (runtimeState.initializing) return runtimeState.initializing
  const operation = prepareDesktop()
  runtimeState.initializing = operation
  void operation
    .finally(() => {
      if (runtimeState.initializing === operation) runtimeState.initializing = null
    })
    .catch(() => {})
  return operation
}

async function prepareDesktop() {
  if (!isDesktop) return
  if (useWorkspace.getState().piUpdating) return
  await initializeLanguage()
  let store = useWorkspace.getState()
  if (!store.onboardingCompleted || store.onboardingOpen) return
  const preferred = store.activeSessionId
  let resumedSession: string | null = null
  const live =
    await invoke<
      Omit<PiConnection, 'sessionId' | 'bindingVersion' | 'packages' | 'ponytailLoaded'>[]
    >('pi_connections')
  // Discovery is authoritative even if an exit event was lost during a reload.
  const liveIds = new Set(live.map((run) => run.id))
  useWorkspace.setState((current) => ({
    piBusyRuns: current.piBusyRuns.filter((id) => liveIds.has(id)),
  }))
  for (const [path, cached] of runtimeState.projectConnections) {
    if (liveIds.has(cached.id)) continue
    runtimeState.projectConnections.delete(path)
    if (runtimeState.currentRun === cached) {
      runtimeState.currentRun = null
      useWorkspace.setState({
        connection: 'disconnected',
        connectionAction: null,
        runningSessionId: null,
      })
    }
  }
  // A refreshed frontend reattaches its event channel to the native-owned process.
  for (const run of live) {
    const project = store.projects.find((project) => project.path === run.path)
    if (!project) continue
    const channel = new Channel<RuntimeEvent>()
    let exited = false
    channel.onmessage = (message) => {
      if (message.runId === run.id && message.event.type === 'runtime_exit') exited = true
      handleEvent(message)
    }
    try {
      await invoke('attach_pi', { runId: run.id, onEvent: channel })
      if (exited) continue
      const state = await invoke<RpcState>('pi_request', {
        runId: run.id,
        command: { id: crypto.randomUUID(), type: 'get_state' },
      })
      useWorkspace.setState((current) => ({
        piBusyRuns: state.isStreaming
          ? [...new Set([...current.piBusyRuns, run.id])]
          : current.piBusyRuns.filter((id) => id !== run.id),
      }))
      if (exited) continue
      const candidates = store.sessions.filter((session) => session.projectId === project.id)
      const matched = candidates.find(
        (session) => state.sessionFile && session.piSessionFile === state.sessionFile,
      )
      // An idle unmatched native session may belong to a deleted desktop session.
      // Keep its process, but never copy its history into a surviving session.
      const session =
        matched ||
        (state.isStreaming
          ? candidates.find((session) => session.id === preferred) || candidates[0]
          : undefined)
      if (!session && state.isStreaming) throw new Error(t('errors.switchWhileRunning'))
      // Preserve a still-running or not-yet-saved session instead of replacing it.
      if (
        session &&
        state.sessionFile &&
        !candidates.some((session) => session.piSessionFile === state.sessionFile)
      ) {
        store.updateSession(session.id, { piSessionFile: state.sessionFile })
      }
      const packages = await invoke<ExtensionPackage[]>('extension_packages', {
        path: run.path,
      }).catch(() => [])
      // The channel can report exit before this run has entered the cache.
      if (exited) continue
      runtimeState.projectConnections.set(run.path, {
        ...run,
        sessionId: session?.id || null,
        bindingVersion: 0,
        packages,
        ponytailLoaded: true,
      })
      if (state.isStreaming && session) resumedSession = session.id
    } catch (error) {
      if (exited) continue
      // Do not kill a potentially running task when attaching or reading state fails.
      // A retry discovers the pool again, including processes that exited meanwhile.
      throw new Error(`${projectTitle(project)}: ${errorText(error)}`, { cause: error })
    }
  }
  store = useWorkspace.getState()
  const target =
    resumedSession ||
    preferred ||
    store.sessions.find(
      (session) => !store.projects.find((project) => project.id === session.projectId)?.hidden,
    )?.id
  if (target && target !== store.activeSessionId) useWorkspace.setState({ activeSessionId: target })
  const failures: string[] = []
  // Warm every saved project before showing the workspace; restore the active one last.
  for (const project of store.projects) {
    if (project.hidden || !project.path) continue
    const session =
      store.sessions.find((session) => session.projectId === project.id && session.id === target) ||
      [...store.sessions]
        .filter((session) => session.projectId === project.id)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (!session) {
      try {
        await warmProject(project)
      } catch (error) {
        const message = errorText(error)
        if (isClosedProjectDirectory(message)) noteClosedProject(project, message)
        else failures.push(`${projectTitle(project)}: ${message}`)
      }
      continue
    }
    if (session.id === target) continue
    await activateSession(session.id)
    recordProjectFailure(project, failures)
  }
  if (target) {
    await activateSession(target)
    const state = useWorkspace.getState()
    // Leave the selected session's directory error in the connection banner.
    if (state.connection === 'error' && !isClosedProjectDirectory(state.connectionError))
      failures.push(state.connectionError || t('connection.failed'))
  }
  if (failures.length) throw new Error(failures.join('\n'))
}

function recordProjectFailure(
  project: Pick<Project, 'id' | 'name' | 'builtin'>,
  failures: string[],
) {
  const state = useWorkspace.getState()
  if (state.connection !== 'error') return
  const message = state.connectionError || t('connection.failed')
  if (!isClosedProjectDirectory(message)) {
    failures.push(`${projectTitle(project)}: ${message}`)
    return
  }
  noteClosedProject(project, message)
  useWorkspace.setState({ connection: 'disconnected', connectionError: null })
}
