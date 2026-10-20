import { invoke } from '@tauri-apps/api/core'
import type { RpcState } from '../../types'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { normalizeMessages, normalizeUsage, reconcileUserMessageIds } from '../rpc'
import { modelKey } from '../utils'
import { runtimeState } from './runtimeState'
import { refreshCapabilityBridge } from '../capabilities/bridge'
import { applyCapabilityReceipts } from '../capabilities/presentation'

export async function request<T>(command: Record<string, unknown>): Promise<T> {
  const run = runtimeState.currentRun
  if (!isDesktop || !run) throw new Error(t('errors.desktopRequired'))
  const store = useWorkspace.getState()
  if (store.piUpdating && command.type !== 'extension_ui_response')
    throw new Error(t('piUpdate.busy'))
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
  const bridge = await refreshCapabilityBridge(true)
  if (runtimeState.currentRun !== run || run.bindingVersion !== bindingVersion) return
  const current = useWorkspace.getState().sessions.find((session) => session.id === sessionId)
  useWorkspace.getState().updateSession(sessionId, {
    piSessionFile: state.sessionFile,
    messages:
      !bridge && current?.pendingCapabilitySend
        ? current.messages
        : reconcileUserMessageIds(
            current?.messages ?? [],
            normalizeMessages(
              applyCapabilityReceipts(
                data.messages,
                bridge?.receipts || current?.capabilityReceipts || [],
              ),
            ),
            bridge?.receipts || current?.capabilityReceipts || [],
          ),
    ...(bridge ? { capabilityReceipts: bridge.receipts } : {}),
    ...(bridge ? { capabilities: { ...current?.capabilities, mode: bridge.mode } } : {}),
    usage: normalizeUsage(stats),
    modelKey: state.model ? modelKey(state.model) : '',
    thinking: state.thinkingLevel,
    ...(state.sessionName ? { title: state.sessionName } : {}),
  })
}
