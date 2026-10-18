import { useState } from 'react'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import {
  capabilityAvailable,
  resolveCapabilities,
  isPlanCapability,
} from '../../lib/capabilities/catalog'
import { capabilityError, setCapabilityMode } from '../../lib/capabilities/bridge'
import type { Capability } from '../../lib/capabilities/types'
import {
  commandCapability,
  desktopCommandEnabled,
  type DiscoverableCommand,
} from '../../lib/commands'

export function useComposerCapabilities(commands: DiscoverableCommand[]) {
  const preferences = useWorkspace((s) => s.capabilityPreferences)
  const session = useWorkspace((s) => s.sessions.find((item) => item.id === s.activeSessionId))
  const connected = useWorkspace((s) => s.connection === 'connected')
  const ready = useWorkspace((s) => Boolean(s.capabilityBridge))
  const unavailableTargets = useWorkspace((s) => s.capabilityBridge?.unavailableTargets)
  const [pending, setPending] = useState(false),
    [error, setError] = useState('')
  const t = useT()
  const capabilities = resolveCapabilities(preferences, commands, t)
  const selection = session?.capabilities || {}
  function unavailableReason(capability: Capability) {
    if (!capabilities.some((item) => item.id === capability.id && item.enabled))
      return t('library.disabledError')
    if (isDesktop && !connected) return t('commands.disconnected')
    if (isDesktop && !ready) return t('capability.bridgeUnavailable')
    if (
      !capabilityAvailable(capability, commands) ||
      (capability.target && unavailableTargets?.includes(capability.target.name))
    )
      return t('capability.unavailable')
    if (
      (isPlanCapability(selection.mode) && (capability.modifies || capability.target)) ||
      (isPlanCapability(capability) && (selection.task?.modifies || selection.task?.target))
    )
      return t('capability.planConflict')
    return ''
  }
  const unavailable = (capability: Capability) => Boolean(unavailableReason(capability))
  async function select(capability: Capability, remove = false): Promise<boolean> {
    const store = useWorkspace.getState()
    if (pending || !session || store.runningSessionId || store.connection === 'connecting')
      return false
    if (!remove && unavailable(capability)) {
      setError(unavailableReason(capability))
      return false
    }
    setError('')
    if (capability.scope === 'session') {
      setPending(true)
      try {
        await setCapabilityMode(
          remove || selection.mode?.id === capability.id ? undefined : capability,
        )
      } catch (error) {
        setError(capabilityError(error))
        return false
      } finally {
        setPending(false)
      }
    } else
      store.updateSession(session.id, {
        capabilities: {
          ...selection,
          task:
            remove || selection.task?.id === capability.id
              ? undefined
              : structuredClone(capability),
        },
        pendingCapabilitySend: undefined,
      })
    return true
  }
  function argumentsChanged(value: string) {
    if (!session || !selection.task) return
    useWorkspace.getState().updateSession(session.id, {
      capabilities: { ...selection, task: { ...selection.task, arguments: value } },
      pendingCapabilitySend: undefined,
    })
  }
  const slashCommands: DiscoverableCommand[] = [
    ...capabilities
      .filter((c) => c.enabled && !unavailable(c))
      .map((c) => ({
        name: c.alias,
        description: c.description,
        source: c.target?.source || ('builtin' as const),
        sourceInfo: c.target
          ? { path: c.target.origin }
          : { source: t(c.builtin ? 'capability.builtin' : 'capability.user') },
        capabilityId: c.id,
      })),
    ...commands.filter(
      (c) =>
        c.source === 'builtin' &&
        desktopCommandEnabled(c) &&
        commandCapability(c) !== 'terminal' &&
        (!isDesktop || connected),
    ),
  ]
  return {
    capabilities,
    selection,
    pending,
    error,
    unavailable,
    unavailableReason,
    select,
    argumentsChanged,
    slashCommands,
  }
}
