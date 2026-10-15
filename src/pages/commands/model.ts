import type { DiscoverableCommand } from '../../lib/commands'
import { commandOrigin } from '../../lib/draft'

export const sources = ['all', 'builtin', 'extension', 'prompt', 'skill'] as const

export function commandKey(command: DiscoverableCommand) {
  return `${command.source}:${command.name}:${commandOrigin(command)}`
}
