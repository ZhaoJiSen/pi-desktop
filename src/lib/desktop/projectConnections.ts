import { Channel, invoke } from '@tauri-apps/api/core'
import { useWorkspace } from '../../store/workspace'
import type { ExtensionPackage, Project, RpcState, RuntimeEvent } from '../../types'
import { t } from '../i18n'
import { handleEvent } from './events'
import { requestConnection } from './requests'
import { runtimeState, type PiConnection } from './runtimeState'

export async function startProjectConnection(
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

export async function warmProject(project: Project, restoring = false) {
  if (useWorkspace.getState().piUpdating && !restoring) return
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
