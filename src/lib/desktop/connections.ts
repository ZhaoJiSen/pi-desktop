import { Channel, invoke } from '@tauri-apps/api/core'
import type {
  ExtensionPackage,
  Model,
  Project,
  RpcState,
  RuntimeEvent,
  SlashCommand,
  ThinkingLevel,
} from '../../types'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { errorText, modelKey } from '../utils'
import { handleEvent } from './events'
import { requestConnection, syncSession } from './requests'
import { runtimeState, type PiConnection } from './runtimeState'

export async function connectSession(sessionId: string, force = false): Promise<void> {
  // A retained React state during Fast Refresh must not race startup recovery.
  if (runtimeState.initializing) {
    try {
      await runtimeState.initializing
    } catch {
      return
    }
  }
  await activateSession(sessionId, force)
}

async function startProjectConnection(
  project: Project,
  executable: string,
  runId: string,
  sessionId: string | null = null,
  sessionFile: string | null = null,
): Promise<PiConnection> {
  const run: PiConnection = {
    id: runId,
    sessionId,
    bindingVersion: 0,
    path: project.path,
    executable,
    packages: [],
  }
  runtimeState.currentRun = run
  runtimeState.projectConnections.set(project.path, run)
  const channel = new Channel<RuntimeEvent>()
  channel.onmessage = handleEvent
  await invoke('start_pi', {
    path: project.path,
    executable,
    sessionFile,
    runId,
    onEvent: channel,
  })
  return run
}

export async function warmProject(project: Project) {
  const executable = useWorkspace.getState().piExecutable
  const cached = runtimeState.projectConnections.get(project.path)
  if (cached?.executable === executable) return
  if (cached) {
    await invoke('stop_pi', { runId: cached.id })
    runtimeState.projectConnections.delete(project.path)
    if (runtimeState.currentRun === cached) runtimeState.currentRun = null
  }
  const previous = runtimeState.currentRun
  if (previous) previous.bindingVersion++
  const previousConnection = useWorkspace.getState().connection
  const runId = crypto.randomUUID()
  useWorkspace.setState({ connection: 'connecting', connectionAction: 'start' })
  try {
    const run = await startProjectConnection(project, executable, runId)
    await requestConnection<RpcState>({ type: 'get_state' })
    run.packages = await invoke<ExtensionPackage[]>('extension_packages', {
      path: project.path,
    }).catch(() => [])
    if (runtimeState.projectConnections.get(project.path) !== run)
      throw new Error(t('errors.processExited'))
  } catch (error) {
    if (runtimeState.projectConnections.get(project.path)?.id === runId)
      runtimeState.projectConnections.delete(project.path)
    await invoke('stop_pi', { runId }).catch(() => {})
    throw error
  } finally {
    runtimeState.currentRun =
      previous && runtimeState.projectConnections.get(previous.path) === previous ? previous : null
    useWorkspace.setState({
      connection: runtimeState.currentRun?.sessionId ? previousConnection : 'disconnected',
      connectionAction: null,
    })
  }
}

export async function activateSession(sessionId: string, force = false): Promise<void> {
  if (!isDesktop) return
  // Serialize replacements so a late start/switch cannot replace a newer session.
  while (runtimeState.connecting) await runtimeState.connecting
  if (
    runtimeState.currentRun?.sessionId === sessionId &&
    runtimeState.currentRun.executable === useWorkspace.getState().piExecutable &&
    !runtimeState.currentRun.needsReconcile &&
    !force &&
    useWorkspace.getState().connection === 'connected'
  )
    return
  const store = useWorkspace.getState()
  if (store.runningSessionId) {
    useWorkspace.setState({ connectionError: t('errors.switchWhileRunning') })
    return
  }
  const session = store.sessions.find((item) => item.id === sessionId)
  const project = store.projects.find((item) => item.id === session?.projectId)
  if (!session || !project) return
  const previous = runtimeState.currentRun
  const cached = runtimeState.projectConnections.get(project.path)
  const reusable = !force && cached?.executable === store.piExecutable ? cached : undefined
  // Invalidate outstanding work as soon as activation begins, including A → B → A
  // across projects where the native session binding itself does not change.
  if (previous) previous.bindingVersion++
  if (reusable && reusable !== previous) reusable.bindingVersion++
  const reuse = Boolean(reusable)
  const runId = reusable?.id || crypto.randomUUID()
  useWorkspace.setState({
    connection: 'connecting',
    connectionAction: reuse ? 'switch' : 'start',
    connectionError: null,
  })
  const operation = (async () => {
    let replacing = false
    try {
      if (reusable) {
        runtimeState.currentRun = reusable
        if (reusable.needsReconcile || reusable.bindingUncertain || store.connection === 'error') {
          const actual = await requestConnection<RpcState>({ type: 'get_state' })
          if (reusable.bindingUncertain) {
            reusable.sessionId =
              store.sessions.find(
                (item) =>
                  item.projectId === project.id &&
                  actual.sessionFile &&
                  item.piSessionFile === actual.sessionFile,
              )?.id || null
            reusable.bindingUncertain = false
            reusable.bindingVersion++
          }
          if (actual.isStreaming && reusable.sessionId !== sessionId)
            throw new Error(t('errors.switchWhileRunning'))
        }
        if (reusable.sessionId !== sessionId) {
          replacing = true
          const result = await requestConnection<{ cancelled?: boolean }>(
            session.piSessionFile
              ? { type: 'switch_session', sessionPath: session.piSessionFile }
              : { type: 'new_session' },
          )
          replacing = false
          if (result?.cancelled) {
            runtimeState.currentRun = previous
            useWorkspace.setState({
              connection:
                previous?.sessionId && store.connection === 'connected'
                  ? 'connected'
                  : 'disconnected',
              connectionAction: null,
              connectionError: t('errors.switchCancelled'),
              ...(store.activeSessionId === sessionId
                ? { activeSessionId: previous?.sessionId || null }
                : {}),
            })
            return
          }
          reusable.sessionId = sessionId
          reusable.bindingVersion++
        }
      } else {
        if (cached) {
          runtimeState.projectConnections.delete(project.path)
          if (runtimeState.currentRun?.id === cached.id) runtimeState.currentRun = null
          try {
            await invoke('stop_pi', { runId: cached.id })
          } catch (error) {
            runtimeState.projectConnections.set(project.path, cached)
            runtimeState.currentRun = previous
            useWorkspace.setState({
              connection: previous ? 'connected' : 'error',
              connectionAction: null,
              connectionError: errorText(error),
              ...(store.activeSessionId === sessionId && previous
                ? { activeSessionId: previous.sessionId }
                : {}),
            })
            return
          }
        }
        await startProjectConnection(
          project,
          store.piExecutable,
          runId,
          sessionId,
          session.piSessionFile || null,
        )
      }
      if (runtimeState.currentRun?.id !== runId) return
      const [state, catalog, commands, packages] = await Promise.all([
        requestConnection<RpcState>({ type: 'get_state' }),
        requestConnection<{ models: Model[] }>({ type: 'get_available_models' }),
        requestConnection<{ commands: SlashCommand[] }>({ type: 'get_commands' }),
        reuse
          ? Promise.resolve(cached?.packages || [])
          : invoke<ExtensionPackage[]>('extension_packages', { path: project.path }).catch(
              () => [],
            ),
      ])
      if (runtimeState.currentRun?.id !== runId) return
      runtimeState.currentRun.packages = packages
      runtimeState.projectConnections.set(project.path, runtimeState.currentRun)
      useWorkspace.setState({ models: catalog.models, commands: commands.commands, packages })
      const selected = catalog.models.find((model) => modelKey(model) === session.modelKey)
      if (
        !state.isStreaming &&
        selected &&
        modelKey(selected) !== (state.model ? modelKey(state.model) : '')
      ) {
        await requestConnection({
          type: 'set_model',
          provider: selected.provider,
          modelId: selected.id,
        })
      }
      const available = await requestConnection<{ levels: ThinkingLevel[] }>({
        type: 'get_available_thinking_levels',
      })
      const thinking = available.levels.includes(session.thinking)
        ? session.thinking
        : available.levels[0] || 'off'
      if (!state.isStreaming)
        await requestConnection({ type: 'set_thinking_level', level: thinking })
      useWorkspace.setState({ thinkingLevels: available.levels })
      if (!state.isStreaming && session.pendingSessionName) {
        await requestConnection({ type: 'set_session_name', name: session.pendingSessionName })
        useWorkspace.getState().updateSession(sessionId, { pendingSessionName: undefined })
      }
      await syncSession(sessionId)
      if (runtimeState.currentRun?.id === runId) {
        runtimeState.currentRun.needsReconcile = false
        useWorkspace.setState({
          connection: 'connected',
          connectionAction: null,
          runningSessionId: state.isStreaming ? sessionId : null,
        })
      }
    } catch (error) {
      if (runtimeState.currentRun?.id === runId || runtimeState.currentRun === null) {
        if (reusable && runtimeState.projectConnections.get(project.path) === reusable) {
          reusable.needsReconcile = true
          reusable.bindingVersion++
          if (replacing) {
            reusable.sessionId = null
            reusable.bindingUncertain = true
          }
        } else {
          runtimeState.currentRun = null
          if (runtimeState.projectConnections.get(project.path)?.id === runId)
            runtimeState.projectConnections.delete(project.path)
        }
        useWorkspace.setState({
          connection: 'error',
          connectionAction: null,
          connectionError: errorText(error),
          runningSessionId: null,
        })
        if (!reuse) await invoke('stop_pi', { runId }).catch(() => {})
      }
    }
  })()
  runtimeState.connecting = operation
  try {
    await operation
  } finally {
    if (runtimeState.connecting === operation) runtimeState.connecting = null
  }
}
