import { Channel, invoke } from '@tauri-apps/api/core'
import { isDesktop, useWorkspace } from '../store/workspace'
import type { RpcState } from '../types'
import type { PiEnvironment } from './onboarding'
import { activateSession, warmProject } from './desktop/connections'
import { runtimeState, type PiConnection } from './desktop/runtimeState'
import { normalizeMessages, normalizeUsage } from './rpc'
import { errorText, modelKey } from './utils'
import { t } from './i18n'

export interface PiUpdate {
  executable: string
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
}
export type PiUpdatePhase = 'updating' | 'reconnecting'
export class PiReconnectError extends Error {
  constructor(
    detail: string,
    readonly retryConnection: (onPhase: (phase: PiUpdatePhase) => void) => Promise<PiEnvironment>,
  ) {
    super(`${t('piUpdate.reconnectFailed')}\n${detail}`)
  }
}
interface RunSnapshot {
  runId: string
  sessionFile: string | null
}
const checks = new Map<string, Promise<PiUpdate | null>>()

export function checkPiUpdate(executable: string): Promise<PiUpdate | null> {
  if (!isDesktop) return Promise.resolve(null)
  const path = executable.trim() || 'pi'
  const existing = checks.get(path)
  if (existing) return existing
  const operation = invoke<PiUpdate>('check_pi_update', { executable: path })
  checks.set(path, operation)
  void operation.catch(() => {
    if (checks.get(path) === operation) checks.delete(path)
  })
  return operation
}

export async function suppressPiUpdatePrompt() {
  if (isDesktop) await invoke('suppress_pi_update_prompt')
}

export async function claimPiUpdatePrompt(executable: string): Promise<boolean> {
  if (!isDesktop) return false
  return invoke('claim_pi_update_prompt', { executable: executable.trim() || 'pi' })
}

async function runRequest<T>(runId: string, type: string): Promise<T> {
  return invoke('pi_request', { runId, command: { id: crypto.randomUUID(), type } })
}

// Save every native run, rather than just the currently visible conversation.
async function saveConnections(): Promise<{ snapshots: RunSnapshot[]; runs: PiConnection[] }> {
  const live = await invoke<{ id: string; path: string; executable: string }[]>('pi_connections')
  const runs: PiConnection[] = []
  const snapshots: RunSnapshot[] = []
  for (const native of live) {
    const state = await runRequest<
      RpcState & { isCompacting?: boolean; pendingMessageCount?: number }
    >(native.id, 'get_state')
    if (state.isStreaming !== false || state.isCompacting || state.pendingMessageCount)
      throw new Error(t('piUpdate.busy'))
    const [data, stats] = await Promise.all([
      runRequest<{ messages: unknown[] }>(native.id, 'get_messages'),
      runRequest<unknown>(native.id, 'get_session_stats'),
    ])
    const store = useWorkspace.getState()
    const cached = runtimeState.projectConnections.get(native.path)
    const projectSessions = store.sessions.filter(
      (item) =>
        store.projects.find((project) => project.id === item.projectId)?.path === native.path,
    )
    const session =
      projectSessions.find(
        (item) => state.sessionFile && item.piSessionFile === state.sessionFile,
      ) ||
      (!cached?.bindingUncertain && !cached?.needsReconcile
        ? projectSessions.find(
            (item) =>
              item.id === cached?.sessionId &&
              (!item.piSessionFile || item.piSessionFile === state.sessionFile),
          )
        : undefined)
    if (data.messages.length && (!session || !state.sessionFile))
      throw new Error(t('piUpdate.unsavedSession'))
    if (session)
      store.updateSession(session.id, {
        piSessionFile: state.sessionFile,
        messages: normalizeMessages(data.messages),
        usage: normalizeUsage(stats),
        modelKey: state.model ? modelKey(state.model) : '',
        thinking: state.thinkingLevel,
        ...(state.sessionName ? { title: state.sessionName } : {}),
      })
    runs.push({ ...native, sessionId: session?.id || null, bindingVersion: 0, packages: [] })
    snapshots.push({ runId: native.id, sessionFile: state.sessionFile || null })
  }
  // Persistence failures are surfaced by the store in a microtask.
  await Promise.resolve()
  if (useWorkspace.getState().storageError) throw new Error(t('piUpdate.unsavedSession'))
  return { runs, snapshots }
}

async function restoreConnections(runs: PiConnection[], active: string | null) {
  const failures: string[] = []
  for (const run of runs) {
    const store = useWorkspace.getState()
    const project = store.projects.find((item) => item.path === run.path)
    if (!project) continue
    try {
      if (run.sessionId) {
        await activateSession(run.sessionId, true, true)
        if (useWorkspace.getState().connection === 'error')
          throw new Error(useWorkspace.getState().connectionError || t('connection.failed'))
      } else await warmProject(project, true)
    } catch (error) {
      failures.push(`${project.name}: ${errorText(error)}`)
    }
  }
  // The selected session may have lost its process before the update started.
  // Restore it last even when only other projects had live connections to save.
  if (active) {
    try {
      await activateSession(active, false, true)
      if (useWorkspace.getState().connection === 'error')
        throw new Error(useWorkspace.getState().connectionError || t('connection.failed'))
    } catch (error) {
      failures.push(errorText(error))
    }
  }
  if (failures.length) throw new Error(failures.join('\n'))
}

async function retryConnection(
  runs: PiConnection[],
  active: string | null,
  environment: PiEnvironment,
  onPhase: (phase: PiUpdatePhase) => void,
): Promise<PiEnvironment> {
  const state = useWorkspace.getState()
  if (
    state.piUpdating ||
    state.runningSessionId ||
    state.piBusyRuns.length ||
    state.connection === 'connecting' ||
    runtimeState.connecting
  )
    throw new PiReconnectError(t('piUpdate.busy'), (phase) =>
      retryConnection(runs, active, environment, phase),
    )
  useWorkspace.setState({ piUpdating: true })
  onPhase('reconnecting')
  try {
    await restoreConnections(runs, active)
    return environment
  } catch (error) {
    useWorkspace.setState({ connection: 'error', connectionError: errorText(error) })
    throw new PiReconnectError(errorText(error), (phase) =>
      retryConnection(runs, active, environment, phase),
    )
  } finally {
    useWorkspace.setState({ piUpdating: false })
  }
}

export async function upgradePi(
  executable: string,
  onPhase: (phase: PiUpdatePhase) => void,
): Promise<PiEnvironment> {
  const store = useWorkspace.getState()
  if (
    store.piUpdating ||
    store.runningSessionId ||
    store.piBusyRuns.length ||
    store.connection === 'connecting' ||
    runtimeState.connecting ||
    runtimeState.initializing
  )
    throw new Error(t('piUpdate.busy'))
  useWorkspace.setState({ piUpdating: true })
  onPhase('updating')
  let stopped = false
  let saved: Awaited<ReturnType<typeof saveConnections>> | undefined
  let environment: PiEnvironment | undefined
  let failure: unknown
  const clearConnections = () => {
    for (const run of runtimeState.projectConnections.values()) run.bindingVersion++
    runtimeState.projectConnections.clear()
    runtimeState.currentRun = null
    useWorkspace.setState({ connection: 'disconnected', connectionError: null, piBusyRuns: [] })
  }
  try {
    saved = await saveConnections()
    const channel = new Channel<{ stage: string }>()
    channel.onmessage = ({ stage }) => {
      if (stage === 'stopping') {
        stopped = true
        clearConnections()
      }
    }
    environment = await invoke<PiEnvironment>('upgrade_pi', {
      executable: executable.trim() || 'pi',
      sessions: saved.snapshots,
      onProgress: channel,
    })
    checks.clear()
  } catch (error) {
    failure = error
  }
  try {
    if (stopped && saved) {
      clearConnections()
      onPhase('reconnecting')
      await restoreConnections(saved.runs, store.activeSessionId)
    }
  } catch (error) {
    const updated = environment
    const runs = saved?.runs
    failure =
      updated && runs
        ? new PiReconnectError(errorText(error), (phase) =>
            retryConnection(runs, store.activeSessionId, updated, phase),
          )
        : new Error(
            [failure ? errorText(failure) : '', t('piUpdate.reconnectFailed'), errorText(error)]
              .filter(Boolean)
              .join('\n'),
          )
    useWorkspace.setState({ connection: 'error', connectionError: errorText(error) })
  } finally {
    useWorkspace.setState({ piUpdating: false })
  }
  if (failure) throw failure
  if (!environment) throw new Error(t('piUpdate.failed'))
  return environment
}
