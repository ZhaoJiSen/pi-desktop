import { isDesktop, useWorkspace } from '../../store/workspace'
import { request, requestConnection } from '../desktop/requests'
import { runtimeState } from '../desktop/runtimeState'
import { t } from '../i18n'
import { messages } from '../locale'
import { errorText } from '../utils'
import type { Capability, CapabilityBridgeState } from './types'

export function capabilityError(error: unknown) {
  const value = errorText(error)
  const catalog: Record<string, string> = messages[useWorkspace.getState().language]
  return value.startsWith('capability.') ? catalog[value] || value : value
}
export async function bridgeCall(call: Record<string, unknown>, connecting = false) {
  if (
    !useWorkspace
      .getState()
      .commands.some(
        (command) =>
          command.name === 'desktop-bridge' &&
          command.source === 'extension' &&
          command.description === 'Pi Desktop capability transport v1',
      )
  )
    throw new Error(t('capability.bridgeUnavailable'))
  const result = await (connecting ? requestConnection : request)<
    CapabilityBridgeState & { accepted?: boolean }
  >({
    type: 'desktop_bridge',
    call,
  })
  if (result.version !== 1) throw new Error(t('capability.bridgeUnavailable'))
  return result
}
export async function refreshCapabilityBridge(connecting = false) {
  const run = runtimeState.currentRun
  const binding = run?.bindingVersion
  const commands = useWorkspace.getState().commands
  if (
    !commands.some(
      (c) =>
        c.name === 'desktop-bridge' &&
        c.source === 'extension' &&
        c.description === 'Pi Desktop capability transport v1',
    )
  ) {
    useWorkspace.setState({
      capabilityBridge: null,
      capabilityBridgeError: t('capability.bridgeUnavailable'),
    })
    return null
  }
  try {
    const state = await bridgeCall({ op: 'status' }, connecting)
    if (runtimeState.currentRun !== run || run?.bindingVersion !== binding) return null
    useWorkspace.setState({ capabilityBridge: state, capabilityBridgeError: '' })
    return state
  } catch (error) {
    if (runtimeState.currentRun === run && run?.bindingVersion === binding)
      useWorkspace.setState({
        capabilityBridge: null,
        capabilityBridgeError: capabilityError(error),
      })
    return null
  }
}
export async function setCapabilityMode(mode?: Capability) {
  const store = useWorkspace.getState()
  const id = store.activeSessionId
  if (!id || store.runningSessionId || store.connection === 'connecting') return
  if (isDesktop) {
    const state = await bridgeCall({ op: 'mode', mode: mode || null })
    useWorkspace.setState({ capabilityBridge: state })
    const session = useWorkspace.getState().sessions.find((s) => s.id === id)
    store.updateSession(id, {
      capabilities: { ...session?.capabilities, mode: state.mode },
      pendingCapabilitySend: undefined,
    })
  } else {
    const session = store.sessions.find((s) => s.id === id)
    store.updateSession(id, {
      capabilities: { ...session?.capabilities, mode },
      pendingCapabilitySend: undefined,
    })
  }
}
