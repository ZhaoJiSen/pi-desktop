import type { ExtensionRequest, Message, MessageAnchor } from '../types'

type AnchorResolver = (request: ExtensionRequest) => number | undefined
const resolvers = new WeakMap<Message[], AnchorResolver>()

/** Only carry an index across updates that preserve IDs, timestamps and tool call IDs. */
export function reuseQuestionAnchorIndex(previous: Message[], next: Message[]) {
  const resolve = resolvers.get(previous)
  if (resolve) resolvers.set(next, resolve)
}

export function captureQuestionAnchor(messages: Message[]): MessageAnchor | null {
  const last = messages.at(-1)
  if (!last) return null
  return {
    role: last.role,
    timestamp: last.timestamp,
    occurrence:
      messages.filter((item) => item.role === last.role && item.timestamp === last.timestamp)
        .length - 1,
    toolCallIds: last.blocks.flatMap((block) =>
      block.type === 'tool' && block.id ? [block.id] : [],
    ),
  }
}

/** Index identities lazily; text-only stream snapshots share the same resolver. */
export function questionAnchorResolver(messages: Message[]) {
  const cached = resolvers.get(messages)
  if (cached) return cached
  const ids = new Map<string, number>()
  const calls = new Map<string, number>()
  const times = new Map<string, number[]>()
  messages.forEach((message, index) => {
    ids.set(message.id, index)
    for (const block of message.blocks)
      if (block.type === 'tool' && block.id) calls.set(block.id, index)
    const key = `${message.role}:${message.timestamp}`
    const group = times.get(key) ?? []
    group.push(index)
    times.set(key, group)
  })
  const resolve: AnchorResolver = (request) => {
    if (request.afterMessageId && ids.has(request.afterMessageId))
      return ids.get(request.afterMessageId)
    const anchor = request.afterMessageAnchor
    if (anchor === null) return -1
    if (!anchor) return undefined
    for (let i = anchor.toolCallIds.length - 1; i >= 0; i--) {
      const id = anchor.toolCallIds[i]
      const index = calls.get(id)
      if (index !== undefined) return index
    }
    // A captured tool call that disappeared belongs to a removed branch/compacted turn.
    if (anchor.toolCallIds.length) return undefined
    return times.get(`${anchor.role}:${anchor.timestamp}`)?.[anchor.occurrence]
  }
  resolvers.set(messages, resolve)
  return resolve
}
