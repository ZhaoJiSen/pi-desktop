import { describe, expect, it } from 'vitest'
import { applyStreamEvent, normalizeMessages, normalizeUsage, parseDiff } from './rpc'
import type { Message } from '../types'

describe('pi RPC reconstruction', () => {
  it('replaces streamed deltas with authoritative completed content, preserving Unicode', () => {
    let messages: Message[] = []
    messages = applyStreamEvent(messages, { type: 'message_start', message: { role: 'assistant', content: [], timestamp: 1 } })
    messages = applyStreamEvent(messages, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: '你好\u2028' } })
    messages = applyStreamEvent(messages, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: '世界' } })
    expect(messages[0].blocks[0]).toEqual({ type: 'text', text: '你好\u2028世界' })
    messages = applyStreamEvent(messages, { type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: '最终回复' }], timestamp: 1 } })
    expect(messages).toHaveLength(1)
    expect(messages[0].blocks).toEqual([{ type: 'text', text: '最终回复' }])
  })

  it('correlates tool output by call ID across assistant turns, never by list position', () => {
    let messages: Message[] = [
      { id: 'first', role: 'assistant', timestamp: 1, blocks: [{ type: 'tool', id: 'edit-1', name: 'edit', label: 'app.ts', args: {}, status: 'running', output: '' }] },
      { id: 'second', role: 'assistant', timestamp: 2, blocks: [{ type: 'text', text: '继续检查' }] },
    ]
    messages = applyStreamEvent(messages, { type: 'tool_execution_end', toolCallId: 'edit-1', result: { content: [{ type: 'text', text: '文件已更新' }], details: { diff: '+12 const next = true\n-12 const next = false' } }, isError: false })
    expect(messages[0].blocks[0]).toMatchObject({ status: 'done', output: '文件已更新', diff: [{ number: 12, kind: 'add', text: 'const next = true' }, { number: 12, kind: 'remove', text: 'const next = false' }] })
    expect(messages[1].blocks[0]).toEqual({ type: 'text', text: '继续检查' })
  })

  it('hydrates completed tool results and marks unfinished historical calls interrupted', () => {
    const messages = normalizeMessages([
      { role: 'user', content: '读取文件', timestamp: 1 },
      { role: 'assistant', content: [{ type: 'toolCall', id: 'done', name: 'read', arguments: { path: 'models.ts' } }, { type: 'toolCall', id: 'unfinished', name: 'bash', arguments: { command: 'pwd' } }], timestamp: 2 },
      { role: 'toolResult', toolCallId: 'done', content: [{ type: 'text', text: 'export const models = []' }], isError: false },
    ])
    expect(messages).toHaveLength(2)
    expect(messages[1].blocks[0]).toMatchObject({ id: 'done', status: 'done', output: 'export const models = []' })
    expect(messages[1].blocks[1]).toMatchObject({ id: 'unfinished', status: 'interrupted' })
  })

  it('uses current contextUsage from pi instead of cumulative tokens and preserves unknown after compaction', () => {
    const stats = { tokens: { input: 90000, output: 10000, cacheRead: 30000, cacheWrite: 5000, total: 135000 }, cost: .23, contextUsage: { tokens: 36000, contextWindow: 200000, percent: 18 } }
    expect(normalizeUsage(stats)).toMatchObject({ total: 135000, contextPercent: 18, contextTokens: 36000, cacheRead: 30000 })
    expect(normalizeUsage({ ...stats, contextUsage: { tokens: null, percent: null, contextWindow: 200000 } })).toMatchObject({ contextTokens: null, contextPercent: null, contextWindow: 200000 })
  })

  it('parses line numbers without dropping code indentation', () => {
    expect(parseDiff('+117     <SearchInput />')[0]).toEqual({ number: 117, kind: 'add', text: '    <SearchInput />' })
  })
})
