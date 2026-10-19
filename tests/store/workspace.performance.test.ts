import { performance } from 'node:perf_hooks'
import { afterEach, expect, it, vi } from 'vitest'
import { createWorkspaceStore } from '../../src/store/workspace'
import { makeSession } from '../../src/lib/fixtures'
import { applyStreamEvent } from '../../src/lib/rpc'
import type { Message } from '../../src/types'

afterEach(() => vi.useRealTimers())

it('measures a stream with 300 saved sessions and a 2,000-message active thread', () => {
  vi.useFakeTimers()
  let writes = 0,
    bytes = 0
  const store = createWorkspaceStore({
    getItem: () => null,
    removeItem: () => {},
    setItem: (_key, value) => {
      writes++
      bytes += value.length
    },
  })
  const sessions = Array.from({ length: 300 }, (_, i) => ({
    ...makeSession('project'),
    id: `session-${i}`,
    messages: Array.from({ length: i === 0 ? 2000 : 20 }, (_, j): Message => ({
      id: `${i}-${j}`,
      role: 'assistant',
      timestamp: j,
      blocks: [
        { type: 'text', text: 'A representative saved reply with code and context. '.repeat(8) },
      ],
    })),
  }))
  store.setState({ sessions, activeSessionId: sessions[0].id, runningSessionId: sessions[0].id })
  writes = 0
  bytes = 0
  const start = performance.now()
  for (let i = 0; i < 100; i++)
    store.getState().appendEvent(sessions[0].id, {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: '你好' },
    })
  const streamMs = performance.now() - start
  store.setState({ runningSessionId: null })
  vi.runAllTimers()
  console.info(
    JSON.stringify({
      streamMs: Math.round(streamMs),
      writes,
      serializedMB: +(bytes / 1e6).toFixed(2),
    }),
  )
  expect(writes).toBe(1)
  expect(bytes).toBeLessThan(5_000_000)
  expect(store.getState().sessions[0].messages.at(-1)?.blocks[0]).toMatchObject({
    text: expect.stringContaining('你好'.repeat(100)),
  })
})

it('measures historical message invalidation for one tool update', () => {
  const messages: Message[] = Array.from({ length: 2000 }, (_, i) => ({
    id: String(i),
    role: 'assistant',
    timestamp: i,
    blocks: [
      {
        type: 'tool',
        id: `tool-${i}`,
        name: 'bash',
        label: 'pwd',
        args: {},
        status: 'running',
        output: '',
      },
    ],
  }))
  const next = applyStreamEvent(messages, {
    type: 'tool_execution_update',
    toolCallId: 'tool-1999',
    partialResult: { content: [{ type: 'text', text: '/workspace' }] },
  })
  console.info(
    JSON.stringify({ invalidatedMessages: next.filter((item, i) => item !== messages[i]).length }),
  )
  expect(next.filter((item, i) => item !== messages[i])).toHaveLength(1)
  expect(next.at(-1)?.blocks[0]).toMatchObject({ output: '/workspace' })
})

it('does not notify subscribers or save events that do not change messages', () => {
  const storage = { getItem: () => null, removeItem: () => {}, setItem: vi.fn() }
  const store = createWorkspaceStore(storage)
  const id = store.getState().createSession('project')
  const listener = vi.fn()
  store.subscribe(listener)
  storage.setItem.mockClear()
  store.getState().appendEvent(id, { type: 'agent_end' })
  store
    .getState()
    .appendEvent('missing', { type: 'message_start', message: { role: 'assistant', content: [] } })
  expect(listener).not.toHaveBeenCalled()
  expect(storage.setItem).not.toHaveBeenCalled()
})
