import { describe, expect, it } from 'vitest'
import {
  applyStreamEvent,
  normalizeMessages,
  normalizeUsage,
  parseDiff,
  reconcileUserMessageIds,
} from '../../src/lib/rpc'
import type { Message } from '../../src/types'
import type { CapabilityReceipt } from '../../src/lib/capabilities/types'
import { applyCapabilityReceipts } from '../../src/lib/capabilities/presentation'

describe('pi RPC reconstruction', () => {
  it('uses receipt identities for repeated display text and ignores receipts from other requests', () => {
    const pending: Message = {
      id: 'local-user',
      role: 'user',
      timestamp: 999,
      blocks: [{ type: 'text', text: 'Review' }],
      pendingPrompt: '/review Review',
      capabilityRequestId: 'request-current',
    }
    const receipts: CapabilityReceipt[] = [
      {
        id: 'request-other',
        body: 'Review',
        timestamp: 4,
        userIndex: 0,
        sourceTimestamp: 5,
        selection: {},
      },
      {
        id: 'request-current',
        body: 'Review',
        timestamp: 9,
        userIndex: 1,
        sourceTimestamp: 10,
        selection: {},
      },
    ]
    const canonical = normalizeMessages([
      { role: 'user', content: 'Review', timestamp: 5 },
      { role: 'user', content: 'Review', timestamp: 10 },
    ])
    const result = reconcileUserMessageIds([pending], canonical, receipts)
    expect(result[0].id).not.toBe(pending.id)
    expect(result[1]).toMatchObject({ id: pending.id, capabilityRequestId: 'request-current' })
    const identicalTextPending = { ...pending, pendingPrompt: 'Review' }
    expect(
      reconcileUserMessageIds([identicalTextPending], canonical.slice(0, 1), receipts)[0].id,
    ).not.toBe(pending.id)
  })
  it('retains submission identity when canonical history arrives before its receipt', () => {
    const pending: Message = {
      id: 'local-user',
      role: 'user',
      timestamp: 999,
      blocks: [{ type: 'text', text: 'Review' }],
      pendingPrompt: '/review Review',
      capabilityRequestId: 'request-current',
    }
    const first = reconcileUserMessageIds(
      [pending],
      normalizeMessages([{ role: 'user', content: '/review Review', timestamp: 10 }]),
    )
    expect(first[0]).toMatchObject({ id: pending.id, capabilityRequestId: 'request-current' })
    expect(first[0].pendingPrompt).toBeUndefined()
    const receipt: CapabilityReceipt = {
      id: 'request-current',
      body: 'Review',
      timestamp: 9,
      userIndex: 0,
      sourceTimestamp: 10,
      selection: {},
    }
    const second = reconcileUserMessageIds(
      first,
      normalizeMessages([{ role: 'user', content: 'Review', timestamp: 10 }]),
      [receipt],
    )
    expect(second[0]).toMatchObject({ id: pending.id, blocks: [{ type: 'text', text: 'Review' }] })
  })
  it('associates only the new optimistic turn after the same history prefix and keeps its ID on later syncs', () => {
    const history = [
      { role: 'user', content: 'Repeat this', timestamp: 1 },
      { role: 'assistant', content: 'Done', timestamp: 2 },
    ]
    const pending: Message = {
      id: 'local-user',
      role: 'user',
      timestamp: 999,
      blocks: [{ type: 'text', text: 'Repeat this' }],
      pendingPrompt: 'Repeat this',
    }
    const previous = [...normalizeMessages(history), pending]
    const snapshot = normalizeMessages([
      ...history,
      { role: 'user', content: 'Repeat this', timestamp: 3 },
      { role: 'assistant', content: 'Next reply', timestamp: 4 },
    ])
    const first = reconcileUserMessageIds(previous, snapshot)
    expect(first[0].id).not.toBe(pending.id)
    expect(first[2]).toMatchObject({ id: pending.id, timestamp: 3 })
    expect(first[2].pendingPrompt).toBeUndefined()
    const second = reconcileUserMessageIds(
      first,
      normalizeMessages([
        ...history,
        { role: 'user', content: 'Repeat this', timestamp: 3 },
        { role: 'assistant', content: 'Next reply', timestamp: 4 },
      ]),
    )
    expect(second[2].id).toBe(pending.id)
    expect(previous[2]).toBe(pending)
    expect(snapshot[2].id).not.toBe(pending.id)
  })
  it('matches the submitted text rather than display text for commands and file attachments', () => {
    const pending: Message = {
      id: 'local',
      role: 'user',
      timestamp: 99,
      blocks: [{ type: 'text', text: 'Review' }],
      pendingPrompt: '/review expanded instructions\n\n<file name="a.txt">\nnotes\n</file>',
    }
    const canonical = normalizeMessages([
      { role: 'user', content: pending.pendingPrompt, timestamp: 100 },
    ])
    expect(reconcileUserMessageIds([pending], canonical)[0].id).toBe(pending.id)
  })
  it.each([false, true])(
    'uses receipt identity for repeated capability bodies, including consumed commands: %s',
    (consumed) => {
      const pending: Message = {
        id: 'local-second',
        role: 'user',
        timestamp: 999,
        blocks: [{ type: 'text', text: 'Review' }],
        pendingPrompt: '/review hidden arguments\n\n<file name="notes.txt">private</file>',
        capabilityRequestId: 'second-request',
      }
      const first: Message = {
        id: 'local-first',
        role: 'user',
        timestamp: 10,
        blocks: [{ type: 'text', text: 'Review' }],
        capabilityRequestId: 'first-request',
      }
      const receipts: CapabilityReceipt[] = [
        {
          id: 'first-request',
          body: 'Review',
          timestamp: 5,
          userIndex: 0,
          sourceTimestamp: 10,
          selection: {},
        },
        {
          id: 'second-request',
          body: 'Review',
          timestamp: 15,
          ...(consumed ? {} : { userIndex: 1, sourceTimestamp: 20 }),
          selection: {},
        },
      ]
      const raw = [
        { role: 'user', content: '/review first', timestamp: 10 },
        ...(consumed ? [] : [{ role: 'user', content: pending.pendingPrompt, timestamp: 20 }]),
        { role: 'assistant', content: 'Reviewed', timestamp: 30 },
      ]
      const presented = normalizeMessages(applyCapabilityReceipts(raw, receipts))
      const reconciled = reconcileUserMessageIds([first, pending], presented, receipts)
      expect(reconciled.slice(0, 2).map((message) => message.id)).toEqual([
        'local-first',
        'local-second',
      ])
      expect(reconciled[1]).toMatchObject({
        capabilityRequestId: 'second-request',
        blocks: [{ type: 'text', text: 'Review' }],
      })
      expect(reconciled[1].pendingPrompt).toBeUndefined()
      expect(reconcileUserMessageIds(reconciled, presented, receipts)).toEqual(reconciled)

      // A different branch can have the same body and offset, but not the same receipt.
      const otherReceipt = { ...receipts[1], id: 'other-request' }
      const otherBranch = normalizeMessages(
        applyCapabilityReceipts(raw, [receipts[0], otherReceipt]),
      )
      expect(
        reconcileUserMessageIds([first, pending], otherBranch, [receipts[0], otherReceipt])[1].id,
      ).not.toBe(pending.id)
    },
  )
  it('does not move an optimistic anchor to a different branch or a different prompt', () => {
    const before = normalizeMessages([{ role: 'assistant', content: 'Before', timestamp: 1 }])
    const pending: Message = {
      id: 'local',
      role: 'user',
      timestamp: 99,
      blocks: [{ type: 'text', text: 'Repeat this' }],
      pendingPrompt: 'Repeat this',
    }
    for (const raw of [
      [{ role: 'user', content: 'Repeat this', timestamp: 3 }],
      [
        { role: 'assistant', content: 'Other branch', timestamp: 2 },
        { role: 'user', content: 'Repeat this', timestamp: 3 },
      ],
      [
        { role: 'assistant', content: 'Before', timestamp: 1 },
        { role: 'user', content: 'Different', timestamp: 3 },
      ],
    ]) {
      expect(
        reconcileUserMessageIds([...before, pending], normalizeMessages(raw)).some(
          (message) => message.id === pending.id,
        ),
      ).toBe(false)
    }
  })
  it('replaces streamed deltas with authoritative completed content, preserving Unicode', () => {
    let messages: Message[] = []
    messages = applyStreamEvent(messages, {
      type: 'message_start',
      message: { role: 'assistant', content: [], timestamp: 1 },
    })
    messages = applyStreamEvent(messages, {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: '你好\u2028' },
    })
    messages = applyStreamEvent(messages, {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: '世界' },
    })
    expect(messages[0].blocks[0]).toEqual({ type: 'text', text: '你好\u2028世界' })
    messages = applyStreamEvent(messages, {
      type: 'message_end',
      message: { role: 'assistant', content: [{ type: 'text', text: '最终回复' }], timestamp: 1 },
    })
    expect(messages).toHaveLength(1)
    expect(messages[0].blocks).toEqual([{ type: 'text', text: '最终回复' }])
  })

  it('correlates tool output by call ID across assistant turns, never by list position', () => {
    let messages: Message[] = [
      {
        id: 'first',
        role: 'assistant',
        timestamp: 1,
        blocks: [
          {
            type: 'tool',
            id: 'edit-1',
            name: 'edit',
            label: 'app.ts',
            args: {},
            status: 'running',
            output: '',
          },
        ],
      },
      {
        id: 'second',
        role: 'assistant',
        timestamp: 2,
        blocks: [{ type: 'text', text: '继续检查' }],
      },
    ]
    messages = applyStreamEvent(messages, {
      type: 'tool_execution_end',
      toolCallId: 'edit-1',
      result: {
        content: [{ type: 'text', text: '文件已更新' }],
        details: { diff: '+12 const next = true\n-12 const next = false' },
      },
      isError: false,
    })
    expect(messages[0].blocks[0]).toMatchObject({
      status: 'done',
      output: '文件已更新',
      diff: [
        { number: 12, kind: 'add', text: 'const next = true' },
        { number: 12, kind: 'remove', text: 'const next = false' },
      ],
    })
    expect(messages[1].blocks[0]).toEqual({ type: 'text', text: '继续检查' })
  })

  it('hydrates completed tool results and marks unfinished historical calls interrupted', () => {
    const messages = normalizeMessages([
      { role: 'user', content: '读取文件', timestamp: 1 },
      {
        role: 'assistant',
        content: [
          { type: 'toolCall', id: 'done', name: 'read', arguments: { path: 'models.ts' } },
          { type: 'toolCall', id: 'unfinished', name: 'bash', arguments: { command: 'pwd' } },
        ],
        timestamp: 2,
      },
      {
        role: 'toolResult',
        toolCallId: 'done',
        content: [{ type: 'text', text: 'export const models = []' }],
        isError: false,
      },
    ])
    expect(messages).toHaveLength(2)
    expect(messages[1].blocks[0]).toMatchObject({
      id: 'done',
      status: 'done',
      output: 'export const models = []',
    })
    expect(messages[1].blocks[1]).toMatchObject({ id: 'unfinished', status: 'interrupted' })
  })

  it('uses current contextUsage from pi instead of cumulative tokens and preserves unknown after compaction', () => {
    const stats = {
      tokens: { input: 90000, output: 10000, cacheRead: 30000, cacheWrite: 5000, total: 135000 },
      cost: 0.23,
      contextUsage: { tokens: 36000, contextWindow: 200000, percent: 18 },
    }
    expect(normalizeUsage(stats)).toMatchObject({
      total: 135000,
      contextPercent: 18,
      contextTokens: 36000,
      cacheRead: 30000,
    })
    expect(
      normalizeUsage({
        ...stats,
        contextUsage: { tokens: null, percent: null, contextWindow: 200000 },
      }),
    ).toMatchObject({ contextTokens: null, contextPercent: null, contextWindow: 200000 })
  })

  it('parses line numbers without dropping code indentation', () => {
    expect(parseDiff('+117     <SearchInput />')[0]).toEqual({
      number: 117,
      kind: 'add',
      text: '    <SearchInput />',
    })
  })
})
