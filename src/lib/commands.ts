import { invoke } from '@tauri-apps/api/core'
import { navigateToPage } from '../router/navigation'
import { request } from './desktop'
import { isDesktop, useWorkspace } from '../store/workspace'
import type { SlashCommand } from '../types'
import { createCommandTag, sessionDraft } from './draft'

export interface DiscoverableCommand extends Omit<SlashCommand, 'source'> {
  source: SlashCommand['source'] | 'builtin'
  argumentHint?: string
}
export function commandCapability(command: DiscoverableCommand) {
  if (command.source !== 'builtin') return 'insert' as const
  if (command.name === 'compact') return 'execute' as const
  if (['settings', 'model', 'thinking', 'session'].includes(command.name))
    return 'navigate' as const
  return 'terminal' as const
}
export function commandSource(command: DiscoverableCommand) {
  return command.sourceInfo?.source || command.sourceInfo?.path || ''
}
const builtinCache = new Map<string, Promise<DiscoverableCommand[]>>()
export function loadBuiltinCommands(executable: string): Promise<DiscoverableCommand[]> {
  if (!isDesktop) return Promise.resolve([])
  const cached = builtinCache.get(executable)
  if (cached) return cached
  const pending = invoke<DiscoverableCommand[]>('builtin_commands', { executable }).catch(
    (error) => {
      builtinCache.delete(executable)
      throw error
    },
  )
  builtinCache.set(executable, pending)
  return pending
}
export function filterCommands(
  commands: DiscoverableCommand[],
  query: string,
  source: string,
  labels: Partial<Record<DiscoverableCommand['source'], string>> = {},
) {
  const search = query.trim().toLowerCase()
  return commands.filter(
    (command) =>
      (source === 'all' || command.source === source) &&
      `${command.name} ${command.description || ''} ${command.source} ${labels[command.source] || ''} ${commandSource(command)}`
        .toLowerCase()
        .includes(search),
  )
}
export async function discoverCommands(): Promise<DiscoverableCommand[]> {
  if (!isDesktop) return []
  const { activeSessionId, piExecutable } = useWorkspace.getState()
  const [runtime, builtin] = await Promise.all([
    request<{ commands: SlashCommand[] }>({ type: 'get_commands' }),
    loadBuiltinCommands(piExecutable),
  ])
  const current = useWorkspace.getState()
  if (
    current.activeSessionId !== activeSessionId ||
    current.piExecutable !== piExecutable ||
    current.connection !== 'connected'
  )
    return []
  useWorkspace.setState({ commands: runtime.commands })
  return [...builtin, ...runtime.commands]
}
export function insertCommand(command: DiscoverableCommand) {
  if (commandCapability(command) !== 'insert') return false
  const store = useWorkspace.getState()
  const session = store.sessions.find((item) => item.id === store.activeSessionId)
  if (!session || store.runningSessionId || store.connection !== 'connected') return false
  // Keep the user's draft intact; command parameters can be reviewed before sending.
  store.updateSession(session.id, {
    draftNodes: [createCommandTag(command), { type: 'text', text: ' ' }, ...sessionDraft(session)],
  })
  void navigateToPage('chat')
  return true
}
