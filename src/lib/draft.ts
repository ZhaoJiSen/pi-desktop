import type { CommandTag, DraftNode, Session } from '../types'
import type { DiscoverableCommand } from './commands'

export const DRAFT_MIME = 'application/x-pi-desktop-draft+json'
export function commandOrigin(command: DiscoverableCommand) {
  return command.sourceInfo?.source || command.sourceInfo?.path || ''
}
export function createCommandTag(command: DiscoverableCommand): CommandTag {
  return {
    type: 'command',
    id: crypto.randomUUID(),
    name: command.name,
    source: command.source,
    origin: commandOrigin(command),
    arguments: '',
  }
}
export function normalizeDraft(nodes: DraftNode[]): DraftNode[] {
  const result: DraftNode[] = []
  for (const node of nodes) {
    const previous = result.at(-1)
    if (node.type === 'text') {
      if (!node.text) continue
      if (previous?.type === 'text') previous.text += node.text
      else result.push({ ...node })
    } else result.push({ ...node })
  }
  return result
}
export function draftText(nodes: DraftNode[]) {
  return nodes
    .map((node) =>
      node.type === 'text'
        ? node.text
        : `/${node.name}${node.arguments ? ` ${node.arguments}` : ''}`,
    )
    .join('')
}
export function sessionDraft(session: Pick<Session, 'draft' | 'draftNodes'>): DraftNode[] {
  return session.draftNodes ?? (session.draft ? [{ type: 'text', text: session.draft }] : [])
}
export function draftLength(nodes: DraftNode[]) {
  return nodes.reduce((sum, node) => sum + (node.type === 'text' ? node.text.length : 1), 0)
}
export function sliceDraft(nodes: DraftNode[], start: number, end = draftLength(nodes)) {
  let offset = 0
  const result: DraftNode[] = []
  for (const node of nodes) {
    const length = node.type === 'text' ? node.text.length : 1
    if (offset < end && offset + length > start) {
      result.push(
        node.type === 'text'
          ? { type: 'text', text: node.text.slice(Math.max(0, start - offset), end - offset) }
          : node,
      )
    }
    offset += length
  }
  return normalizeDraft(result)
}
export function replaceDraft(
  nodes: DraftNode[],
  start: number,
  end: number,
  inserted: DraftNode[],
) {
  return normalizeDraft([...sliceDraft(nodes, 0, start), ...inserted, ...sliceDraft(nodes, end)])
}
export function commandAvailable(tag: CommandTag, commands: DiscoverableCommand[]) {
  return commands.some(
    (command) =>
      command.name === tag.name &&
      command.source === tag.source &&
      commandOrigin(command) === tag.origin,
  )
}

// Clipboard HTML is never trusted. Only this small, versioned schema is restored.
export function decodeDraft(value: string): DraftNode[] | null {
  try {
    const data: unknown = JSON.parse(value)
    if (
      !data ||
      typeof data !== 'object' ||
      !('version' in data) ||
      data.version !== 1 ||
      !('nodes' in data) ||
      !Array.isArray(data.nodes) ||
      data.nodes.length > 1000
    )
      return null
    const nodes: DraftNode[] = []
    for (const node of data.nodes) {
      if (node?.type === 'text' && typeof node.text === 'string')
        nodes.push({ type: 'text', text: node.text })
      else if (
        node?.type === 'command' &&
        typeof node.name === 'string' &&
        /^[\w:.-]+$/.test(node.name) &&
        ['builtin', 'extension', 'prompt', 'skill'].includes(node.source) &&
        typeof node.origin === 'string' &&
        typeof node.arguments === 'string'
      ) {
        nodes.push({
          ...createCommandTag({ name: node.name, source: node.source }),
          origin: node.origin,
          arguments: node.arguments,
        })
      } else return null
    }
    return normalizeDraft(nodes)
  } catch {
    return null
  }
}

export function slashQuery(nodes: DraftNode[], caret: number) {
  // An atom breaks a text token. URL/path slashes and Markdown code are excluded.
  const before = sliceDraft(nodes, 0, caret)
    .map((n) => (n.type === 'text' ? n.text : '\uFFFC'))
    .join('')
  const match = /(?:^|\s)\/([\w:.-]*)$/.exec(before)
  if (!match) return null
  const start = before.length - match[1]!.length - 1
  const prefix = before.slice(0, start)
  const fences = prefix.match(/```|~~~/g)
  if (fences && fences.length % 2) return null
  const line = prefix.slice(prefix.lastIndexOf('\n') + 1)
  if ((line.match(/`/g)?.length ?? 0) % 2 || /^(?: {4}|\t)/.test(line)) return null
  return { start, end: caret, query: match[1]! }
}

export type DraftProblem =
  | 'unavailable'
  | 'multiple'
  | 'terminal'
  | 'mixedAction'
  | 'position'
  | 'attachments'
  | 'shadowed'
export type DraftPlan =
  | { kind: 'error'; problem: DraftProblem; name: string }
  | { kind: 'prompt'; message: string }
  | { kind: 'compact'; instructions: string }
  | { kind: 'navigate'; name: 'settings' | 'model' | 'thinking' | 'session' }

export function planDraft(
  nodes: DraftNode[],
  commands: DiscoverableCommand[],
  attachmentCount = 0,
): DraftPlan {
  const tags = nodes.filter((node): node is CommandTag => node.type === 'command')
  for (const tag of tags) {
    if (!commandAvailable(tag, commands))
      return { kind: 'error', problem: 'unavailable', name: tag.name }
  }
  if (tags.length > 1) return { kind: 'error', problem: 'multiple', name: '' }
  const tag = tags[0]
  if (!tag) return { kind: 'prompt', message: draftText(nodes).trim() }
  // RPC resolves extensions before templates and skills. Never invoke a different
  // command merely because an identically named tag has a different source.
  const runtime = commands.find((c) => c.source !== 'builtin' && c.name === tag.name)
  if (
    tag.source !== 'builtin' &&
    runtime &&
    (runtime.source !== tag.source || commandOrigin(runtime) !== tag.origin)
  )
    return { kind: 'error', problem: 'shadowed', name: tag.name }
  const text = nodes
    .filter((n) => n.type === 'text')
    .map((n) => n.text)
    .join('')
    .trim()
  const args = [tag.arguments.trim(), text].filter(Boolean).join(' ')
  if (tag.source === 'builtin') {
    if (attachmentCount) return { kind: 'error', problem: 'attachments', name: tag.name }
    if (tag.name === 'compact') return { kind: 'compact', instructions: args }
    if (
      tag.name === 'settings' ||
      tag.name === 'model' ||
      tag.name === 'thinking' ||
      tag.name === 'session'
    ) {
      if (args) return { kind: 'error', problem: 'mixedAction', name: tag.name }
      return { kind: 'navigate', name: tag.name }
    }
    return { kind: 'error', problem: 'terminal', name: tag.name }
  }
  if (tag.source === 'extension') {
    if (attachmentCount) return { kind: 'error', problem: 'attachments', name: tag.name }
    const index = nodes.indexOf(tag)
    if (draftText(nodes.slice(0, index)).trim())
      return { kind: 'error', problem: 'position', name: tag.name }
  }
  return { kind: 'prompt', message: `/${tag.name}${args ? ` ${args}` : ''}` }
}
