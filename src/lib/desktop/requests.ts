import { invoke } from '@tauri-apps/api/core'
import type { RpcState } from '../../types'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { normalizeMessages, normalizeUsage } from '../rpc'
import { modelKey } from '../utils'
import { runtimeState } from './runtimeState'

export async function request<T>(command: Record<string, unknown>): Promise<T> {
  const run = runtimeState.currentRun
  if (!isDesktop || !run) throw new Error(t('errors.desktopRequired'))
  const store = useWorkspace.getState()
  // Extensions can ask for confirmation while initialization is still in progress.
  if (
    command.type !== 'extension_ui_response' &&
    (store.connection !== 'connected' ||
      !run.sessionId ||
      run.sessionId !== store.activeSessionId ||
      run.bindingUncertain ||
      run.needsReconcile)
  )
    throw new Error(t('errors.notConnected'))
  return requestConnection<T>(command)
}

export async function requestConnection<T>(command: Record<string, unknown>): Promise<T> {
  const run = runtimeState.currentRun
  if (!isDesktop || !run) throw new Error(t('errors.desktopRequired'))
  const sessionId = run.sessionId
  const bindingVersion = run.bindingVersion
  const value = await invoke<T>('pi_request', {
    runId: run.id,
    command: { id: crypto.randomUUID(), ...command },
  })
  if (
    runtimeState.currentRun !== run ||
    run.sessionId !== sessionId ||
    run.bindingVersion !== bindingVersion
  )
    throw new Error(t('errors.sessionChanged'))
  return value
}

export async function syncSession(sessionId: string) {
  const run = runtimeState.currentRun
  if (!run || run.sessionId !== sessionId || run.bindingUncertain) return
  const bindingVersion = run.bindingVersion
  const [state, data, stats] = await Promise.all([
    requestConnection<RpcState>({ type: 'get_state' }),
    requestConnection<{ messages: unknown[] }>({ type: 'get_messages' }),
    requestConnection<unknown>({ type: 'get_session_stats' }),
  ])
  if (
    runtimeState.currentRun !== run ||
    run.sessionId !== sessionId ||
    run.bindingVersion !== bindingVersion
  )
    return
  useWorkspace.getState().updateSession(sessionId, {
    piSessionFile: state.sessionFile,
    messages: normalizeMessages(data.messages),
    usage: normalizeUsage(stats),
    modelKey: state.model ? modelKey(state.model) : '',
    thinking: state.thinkingLevel,
    ...(state.sessionName ? { title: state.sessionName } : {}),
  })
}
