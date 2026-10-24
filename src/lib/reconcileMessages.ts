import type { Message } from '../types'
import type { CapabilityReceipt } from './capabilities/types'
import { contentText } from './messageContent'

export function reconcileUserMessageIds(
  previous: Message[],
  canonical: Message[],
  receipts: CapabilityReceipt[] = [],
): Message[] {
  const requests = new Map(
    previous
      .filter((message) => message.role === 'user' && message.capabilityRequestId)
      .map((message) => [message.capabilityRequestId, message]),
  )
  const byTimestamp = new Map(
    receipts.flatMap((receipt) => {
      const timestamp =
        receipt.userIndex === undefined ? receipt.timestamp : receipt.sourceTimestamp
      return timestamp === undefined ? [] : [[timestamp, receipt] as const]
    }),
  )
  const users = new Map<number, Message[]>()
  for (const message of previous) {
    if (message.role !== 'user' || message.pendingPrompt !== undefined) continue
    const group = users.get(message.timestamp) ?? []
    group.push(message)
    users.set(message.timestamp, group)
  }
  const seen = new Map<number, number>()
  let samePrefix = true
  return canonical.map((message, index) => {
    const old = previous[index]
    const receipt = message.role === 'user' ? byTimestamp.get(message.timestamp) : undefined
    let id = message.id
    let capabilityRequestId = receipt?.id
    if (message.role === 'user') {
      const occurrence = seen.get(message.timestamp) ?? 0
      seen.set(message.timestamp, occurrence + 1)
      const existing = users.get(message.timestamp)?.[occurrence]
      const text = contentText(message.blocks)
      const submitted = receipt && requests.get(receipt.id)
      // The bridge can rewrite/consume a prompt. Its receipt identifies the
      // actual submission even when neither the text nor timestamp survives.
      if (submitted) id = submitted.id
      else if (!receipt) {
        const matched =
          samePrefix && old?.role === 'user' && old.pendingPrompt === text
            ? old
            : existing && contentText(existing.blocks) === text
              ? existing
              : undefined
        if (matched) {
          id = matched.id
          capabilityRequestId = matched.capabilityRequestId
        }
      }
    }
    // Text alone is ambiguous for repeated prompts. The optimistic replacement
    // must follow the same complete history prefix, not just occupy an offset.
    samePrefix = Boolean(
      samePrefix &&
      old &&
      old.role === message.role &&
      old.timestamp === message.timestamp &&
      (old.role === 'user'
        ? contentText(old.blocks) === contentText(message.blocks)
        : old.blocks
            .filter((block) => block.type === 'tool')
            .map((block) => block.id)
            .join('\0') ===
          message.blocks
            .filter((block) => block.type === 'tool')
            .map((block) => block.id)
            .join('\0')),
    )
    return id === message.id && !capabilityRequestId
      ? message
      : { ...message, id, ...(capabilityRequestId ? { capabilityRequestId } : {}) }
  })
}
