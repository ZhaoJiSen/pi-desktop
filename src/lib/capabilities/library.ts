import type { Capability } from './types'
import type { DiscoverableCommand } from '../commands'
import type { Translator } from '../locale'
import { commandCapability, desktopCommandId } from '../commands'
import { commandOrigin } from '../draft'
import { capabilityAvailable, resolveCapabilities } from './catalog'
import { capabilitySource } from './display'

export type LibraryKind = 'task' | 'mode' | 'command' | 'prompt' | 'skill'
export type LibrarySource = 'desktop' | 'pi' | 'plugin' | 'local' | 'user'
export interface LibraryEntry {
  id: string
  name: string
  description: string
  kind: LibraryKind
  source: LibrarySource
  origin: string
  alias: string
  capability?: Capability
  command?: DiscoverableCommand
  enabled: boolean
  unavailable: boolean
  unavailableReason?: string
}
export function buildLibrary(
  commands: DiscoverableCommand[],
  items: Capability[],
  disabled: string[],
  t: Translator,
  connected: boolean,
  bridgeReady: boolean,
  unavailableTargets: string[] = [],
): LibraryEntry[] {
  const resolved = resolveCapabilities({ showShortcuts: true, visibleCount: 2, items }, commands, t)
  const entries: LibraryEntry[] = resolved.map((capability) => {
    const target = capability.target
    const command = target
      ? commands.find(
          (c) =>
            c.name === target.name &&
            c.source === target.source &&
            commandOrigin(c) === target.origin,
        )
      : undefined
    return {
      id: capability.id,
      name: capability.name,
      description: capability.description,
      kind:
        target?.source === 'skill'
          ? 'skill'
          : target?.source === 'prompt'
            ? 'prompt'
            : target
              ? 'command'
              : capability.scope === 'session'
                ? 'mode'
                : 'task',
      source: capability.builtin
        ? 'desktop'
        : capability.id.startsWith('runtime:')
          ? /node_modules[\\/]|^(?:npm:|git:)/.test(target?.origin || '')
            ? 'plugin'
            : 'local'
          : 'user',
      origin: capabilitySource(capability, t),
      alias: capability.alias,
      capability,
      command,
      enabled: capability.enabled,
      unavailableReason: !connected
        ? t('commands.disconnected')
        : !bridgeReady
          ? t('capability.bridgeUnavailable')
          : t('capability.unavailable'),
      unavailable:
        !connected ||
        !bridgeReady ||
        !capabilityAvailable(capability, commands) ||
        Boolean(target && unavailableTargets.includes(target.name)),
    }
  })
  for (const command of commands) {
    if (command.source !== 'builtin') continue
    entries.push({
      id: desktopCommandId(command),
      name: `/${command.name}`,
      description: command.description || '',
      kind: 'command',
      source: 'pi',
      origin: 'Pi',
      alias: command.name,
      command,
      enabled: !disabled.includes(desktopCommandId(command)),
      unavailable: !connected || commandCapability(command) === 'terminal',
    })
  }
  return entries
}
export function matchesLibrary(entry: LibraryEntry, query: string, t: Translator) {
  const haystack =
    `${entry.name} ${entry.description} /${entry.alias} ${entry.origin} ${entry.capability?.target?.origin || ''} ${t(`library.kind.${entry.kind}`)} ${t(`library.source.${entry.source}`)}`.toLocaleLowerCase()
  return query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}
