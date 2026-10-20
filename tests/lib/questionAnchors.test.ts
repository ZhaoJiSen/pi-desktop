import { describe, expect, it } from 'vitest'
import { captureQuestionAnchor, questionAnchorResolver } from '../../src/lib/questionAnchors'
import type { ExtensionRequest, Message } from '../../src/types'
import { applyStreamEvent, normalizeMessages } from '../../src/lib/rpc'

const message = (id: string, timestamp: number): Message => ({
  id,
  timestamp,
  role: 'assistant',
  blocks: [{ type: 'text', text: 'Repeated prompt' }],
})
const request = (messages: Message[]): ExtensionRequest => ({
  id: 'question',
  method: 'input',
  title: 'Question',
  afterMessageId: messages.at(-1)?.id,
  afterMessageAnchor: captureQuestionAnchor(messages),
})
describe('question correlation across history snapshots', () => {
  it('distinguishes repeated text and equal timestamps without relying on regenerated IDs', () => {
    const before = [message('a', 1), message('b', 1)]
    const anchor = request(before)
    const after = [message('x', 1), message('y', 1), message('z', 2)]
    expect(questionAnchorResolver(after)(anchor)).toBe(1)
  })
  it('uses the original tool call even if its message timestamp and ID change', () => {
    const before = message('a', 1)
    before.blocks.push({
      type: 'tool',
      id: 'ask-1',
      name: 'ask_user_question',
      label: '',
      args: {},
      status: 'running',
      output: '',
    })
    const anchor = request([before])
    const after = { ...before, id: 'canonical', timestamp: 20 }
    expect(questionAnchorResolver([message('intro', 2), after])(anchor)).toBe(1)
    // Another branch with the same timestamp must not inherit the removed tool's question.
    expect(questionAnchorResolver([message('replacement', 1)])(anchor)).toBeUndefined()
  })
  it('distinguishes a known session-start request from an unresolved legacy anchor', () => {
    const resolve = questionAnchorResolver([message('new', 1)])
    expect(resolve(request([]))).toBe(-1)
    expect(
      resolve({ id: 'old', method: 'input', title: 'Legacy', afterMessageId: 'gone' }),
    ).toBeUndefined()
  })
  it('reuses the index for text and tool output but re-resolves added and removed tool anchors', () => {
    let messages = [message('first', 1)]
    const question: ExtensionRequest = {
      id: 'tool',
      method: 'input',
      title: 'Tool question',
      afterMessageAnchor: { role: 'assistant', timestamp: 1, occurrence: 0, toolCallIds: ['ask'] },
    }
    expect(questionAnchorResolver(messages)(question)).toBeUndefined()
    messages = applyStreamEvent(messages, {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'more' },
    })
    expect(questionAnchorResolver(messages)(question)).toBeUndefined()
    messages = applyStreamEvent(messages, {
      type: 'tool_execution_start',
      toolCallId: 'ask',
      toolName: 'ask_user_question',
      args: {},
    })
    expect(questionAnchorResolver(messages)(question)).toBe(0)
    messages = applyStreamEvent(messages, {
      type: 'tool_execution_update',
      toolCallId: 'ask',
      partialResult: { content: 'Partial' },
    })
    expect(questionAnchorResolver(messages)(question)).toBe(0)
    messages = applyStreamEvent(messages, {
      type: 'tool_execution_end',
      toolCallId: 'ask',
      result: { content: 'Done' },
    })
    expect(questionAnchorResolver(messages)(question)).toBe(0)
    messages = applyStreamEvent(messages, {
      type: 'message_end',
      message: { role: 'assistant', timestamp: 1, content: 'Replaced' },
    })
    expect(questionAnchorResolver(messages)(question)).toBeUndefined()
    const synced = normalizeMessages([
      {
        role: 'assistant',
        timestamp: 2,
        content: [{ type: 'toolCall', id: 'ask', name: 'ask_user_question' }],
      },
    ])
    expect(questionAnchorResolver(synced)(question)).toBe(0)
  })
  it('invalidates a cached tool anchor if a text block replaces that tool position', () => {
    const before = applyStreamEvent([message('first', 1)], {
      type: 'tool_execution_start',
      toolCallId: 'ask',
      toolName: 'ask_user_question',
      args: {},
    })
    const question = { ...request(before), afterMessageId: undefined }
    expect(questionAnchorResolver(before)(question)).toBe(0)
    const after = applyStreamEvent(before, {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', contentIndex: 1, delta: 'Replaced tool' },
    })
    expect(questionAnchorResolver(after)(question)).toBeUndefined()
  })
})
