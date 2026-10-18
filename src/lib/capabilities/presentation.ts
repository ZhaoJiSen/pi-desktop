import type { CapabilityReceipt } from './types'
import { record } from '../utils'

// Correlate against timestamps recorded with branch receipts, never prompt text patterns.
export function applyCapabilityReceipts(messages: unknown[], receipts: CapabilityReceipt[]) {
  const bound = new Map(
    receipts.filter((r) => r.sourceTimestamp !== undefined).map((r) => [r.sourceTimestamp, r]),
  )
  const result = messages.map((value) => {
    const message = record(value)
    if (message.role !== 'user') return value
    const receipt = bound.get(Number(message.timestamp))
    return receipt
      ? {
          ...message,
          content: receipt.body,
          capabilityLabel: receipt.selection.task && {
            name: receipt.selection.task.name,
            icon: receipt.selection.task.icon,
          },
        }
      : value
  })
  // Some extension commands consume the input without generating a user message.
  for (const receipt of receipts.filter((r) => r.userIndex === undefined)) {
    const position = result.findIndex(
      (value) => Number(record(value).timestamp || 0) > receipt.timestamp,
    )
    result.splice(position < 0 ? result.length : position, 0, {
      role: 'user',
      content: receipt.body,
      capabilityLabel: receipt.selection.task && {
        name: receipt.selection.task.name,
        icon: receipt.selection.task.icon,
      },
      timestamp: receipt.timestamp,
    })
  }
  return result
}
