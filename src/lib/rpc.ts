import type { DiffLine, Message, MessageBlock, PiEvent, ToolBlock, Usage } from '../types'
import { emptyUsage } from './fixtures'
import { fileName, list, number, record, string } from './utils'

export function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  return list(content).map(item => string(record(item).text)).filter(Boolean).join('\n')
}

export function toolFromCall(value: unknown): ToolBlock {
  const call = record(value)
  const args = record(call.arguments ?? call.args)
  const name = string(call.name ?? call.toolName, 'tool')
  return { type: 'tool', id: string(call.id ?? call.toolCallId), name, args, label: fileName(string(args.path ?? args.file_path, name === 'bash' ? string(args.command) : name)), status: 'running', output: '' }
}

export function parseDiff(text: string): DiffLine[] {
  // pi edit's details.diff uses +123 / -123 / 123 prefixes, not unified-diff hunks.
  return text.split('\n').filter(Boolean).map(line => {
    const match = /^([+\- ])?\s*(\d+) (.*)$/.exec(line)
    return match ? { kind: match[1] === '+' ? 'add' : match[1] === '-' ? 'remove' : 'context', number: Number(match[2]), text: match[3] } : { kind: line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'context', text: line.replace(/^[+\- ]/, '') }
  })
}

function applyToolResult(block: ToolBlock, resultValue: unknown, isError: boolean): ToolBlock {
  const result = record(resultValue)
  const diff = string(record(result.details).diff)
  return { ...block, status: isError ? 'error' : 'done', output: contentText(result.content), ...(diff ? { diff: parseDiff(diff) } : {}) }
}

export function normalizeMessage(value: unknown, id: string = crypto.randomUUID()): Message | null {
  const raw = record(value)
  if (raw.role !== 'assistant' && raw.role !== 'user') return null
  const blocks: MessageBlock[] = typeof raw.content === 'string' ? [{ type: 'text', text: raw.content }] : list(raw.content).flatMap<MessageBlock>(item => {
    const block = record(item)
    if (block.type === 'text') return [{ type: 'text' as const, text: string(block.text) }]
    if (block.type === 'thinking') return [{ type: 'thinking' as const, text: string(block.thinking) }]
    if (block.type === 'toolCall') return [toolFromCall(block)]
    return []
  })
  return { id, role: raw.role, timestamp: number(raw.timestamp) || Date.now(), blocks, ...(raw.errorMessage ? { error: string(raw.errorMessage) } : {}) }
}

export function normalizeMessages(rawMessages: unknown[]): Message[] {
  const messages: Message[] = []
  rawMessages.forEach((value, i) => {
    const raw = record(value)
    if (raw.role === 'toolResult') {
      for (const message of messages) message.blocks = message.blocks.map(block => block.type === 'tool' && block.id === raw.toolCallId ? applyToolResult(block, raw, raw.isError === true) : block)
    } else {
      const message = normalizeMessage(raw, `${string(raw.role)}-${number(raw.timestamp)}-${i}`)
      if (message) messages.push(message)
    }
  })
  // Historical incomplete calls are interrupted; do not revive a phantom running spinner.
  return messages.map(message => ({ ...message, blocks: message.blocks.map(block => block.type === 'tool' && block.status === 'running' ? { ...block, status: 'interrupted' } : block) }))
}

export function applyStreamEvent(messages: Message[], event: PiEvent): Message[] {
  const raw = record(event.message)
  if (event.type === 'message_start' && raw.role === 'assistant') {
    const next = normalizeMessage(raw)
    return next ? [...messages, next] : messages
  }
  let index = messages.reduce((last, message, i) => message.role === 'assistant' ? i : last, -1)
  if (index < 0 && (event.type === 'message_update' || event.type === 'tool_execution_start')) {
    messages = [...messages, { id: crypto.randomUUID(), role: 'assistant', timestamp: Date.now(), blocks: [] }]
    index = messages.length - 1
  }
  if (index < 0) return messages
  const current = messages[index]
  let next = { ...current, blocks: [...current.blocks] }
  if (event.type === 'message_update') {
    const update = record(event.assistantMessageEvent)
    const blockIndex = number(update.contentIndex)
    const kind = string(update.type)
    if (kind.startsWith('text_') || kind.startsWith('thinking_')) {
      const type = kind.startsWith('thinking_') ? 'thinking' : 'text'
      const old = next.blocks[blockIndex]
      const previousText = old && old.type !== 'tool' ? old.text : ''
      const text = kind.endsWith('_delta') ? previousText + string(update.delta) : kind.endsWith('_end') ? string(update.content) : previousText
      // Keep contentIndex positions until the authoritative message_end arrives.
      while (next.blocks.length <= blockIndex) next.blocks.push({ type: 'text', text: '' })
      next.blocks[blockIndex] = { type, text }
    }
  } else if (event.type === 'message_end' && raw.role === 'assistant') {
    const complete = normalizeMessage(raw, current.id)
    if (complete) next = { ...complete, blocks: complete.blocks.map(block => block.type === 'tool' ? current.blocks.find(old => old.type === 'tool' && old.id === block.id) || block : block) }
  } else if (event.type === 'tool_execution_start') {
    const tool = toolFromCall({ id: event.toolCallId, name: event.toolName, arguments: event.args })
    if (!next.blocks.some(block => block.type === 'tool' && block.id === tool.id)) next.blocks.push(tool)
  } else if (event.type === 'tool_execution_end' || event.type === 'tool_execution_update') {
    // Tool results can arrive after a newer assistant message; correlate across the whole branch.
    return messages.map(message => ({ ...message, blocks: message.blocks.map(block => block.type === 'tool' && block.id === event.toolCallId ? event.type === 'tool_execution_end' ? applyToolResult(block, event.result, event.isError === true) : { ...block, output: contentText(record(event.partialResult).content) } : block) }))
  } else return messages
  return messages.map((message, i) => i === index ? next : message)
}

export function normalizeUsage(value: unknown): Usage {
  const stats = record(value)
  const tokens = record(stats.tokens)
  const context = record(stats.contextUsage)
  return { ...emptyUsage, input: number(tokens.input), output: number(tokens.output), cacheRead: number(tokens.cacheRead), cacheWrite: number(tokens.cacheWrite), total: number(tokens.total), cost: number(stats.cost), contextPercent: typeof context.percent === 'number' ? context.percent : null, contextTokens: typeof context.tokens === 'number' ? context.tokens : null, contextWindow: typeof context.contextWindow === 'number' ? context.contextWindow : null }
}
