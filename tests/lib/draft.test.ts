import { describe, expect, it } from 'vitest'
import {
  createCommandTag,
  decodeDraft,
  draftText,
  planDraft,
  replaceDraft,
  slashQuery,
} from '../../src/lib/draft'
import type { DiscoverableCommand } from '../../src/lib/commands'

const review: DiscoverableCommand = {
  name: 'review',
  source: 'extension',
  sourceInfo: { source: 'npm:review' },
}
const skill: DiscoverableCommand = { name: 'skill:inspect', source: 'skill' }
const compact: DiscoverableCommand = { name: 'compact', source: 'builtin' }
const text = (text: string) => ({ type: 'text' as const, text })
describe('structured command drafts', () => {
  it('recognizes only a slash token at a valid caret position', () => {
    expect(slashQuery([text('请分析 /rev')], 7)).toEqual({ start: 4, end: 7, query: 're' })
    for (const value of [
      'https://example.com/rev',
      '`/rev',
      '```ts\n/rev',
      '~~~\n/rev',
      '    /rev',
      '/usr/local',
      'see (/rev',
    ])
      expect(slashQuery([text(value)], value.length)).toBeNull()
    expect(slashQuery([text('`code` /rev')], 11)?.query).toBe('rev')
    expect(slashQuery([text('```\ncode\n```\n/')], 14)?.query).toBe('')
  })
  it('inserts and deletes individual atoms without changing neighboring text or tags', () => {
    const first = createCommandTag(review),
      second = createCommandTag(skill)
    const nodes = [text('before '), first, text(' middle '), second, text(' after')]
    const removed = replaceDraft(nodes, 7, 8, [])
    expect(removed).toEqual([text('before  middle '), second, text(' after')])
    expect(replaceDraft(removed, 3, 3, [first])).toEqual([
      text('bef'),
      first,
      text('ore  middle '),
      second,
      text(' after'),
    ])
  })
  it('restores versioned clipboard metadata with fresh unique ids and rejects untrusted HTML/schema', () => {
    const tag = { ...createCommandTag(review), arguments: 'branch=main' }
    const nodes = [tag, text(' check')]
    const restored = decodeDraft(JSON.stringify({ version: 1, nodes }))!
    expect(restored[0]).toMatchObject({ ...tag, id: expect.any(String) })
    expect((restored[0] as typeof tag).id).not.toBe(tag.id)
    expect(draftText(restored)).toBe('/review branch=main check')
    expect(decodeDraft('<img onerror="alert(1)">')).toBeNull()
    expect(
      decodeDraft(JSON.stringify({ version: 1, nodes: [{ ...tag, name: 'review\n/quit' }] })),
    ).toBeNull()
  })
  it('converts one runtime command using metadata and its parameters', () => {
    const tag = { ...createCommandTag(review), arguments: 'main' }
    expect(planDraft([tag, text(' inspect changes')], [review])).toEqual({
      kind: 'prompt',
      message: '/review main inspect changes',
    })
    expect(planDraft([text('inspect changes '), createCommandTag(skill)], [skill])).toEqual({
      kind: 'prompt',
      message: '/skill:inspect inspect changes',
    })
  })
  it('never concatenates multiple commands or silently drops an unavailable tag', () => {
    expect(
      planDraft([createCommandTag(review), createCommandTag(skill)], [review, skill]),
    ).toMatchObject({ kind: 'error', problem: 'multiple' })
    expect(planDraft([createCommandTag(review), text('keep')], [])).toMatchObject({
      kind: 'error',
      problem: 'unavailable',
    })
    expect(planDraft([text('prefix'), createCommandTag(review)], [review])).toMatchObject({
      kind: 'error',
      problem: 'position',
    })
  })
  it('maps operations separately and rejects mixed navigation, terminal commands and attachments', () => {
    expect(planDraft([createCommandTag(compact), text(' retain code')], [compact])).toEqual({
      kind: 'compact',
      instructions: 'retain code',
    })
    const model: DiscoverableCommand = { name: 'model', source: 'builtin' }
    expect(planDraft([createCommandTag(model)], [model])).toEqual({
      kind: 'navigate',
      name: 'model',
    })
    expect(planDraft([createCommandTag(model), text('hello')], [model])).toMatchObject({
      kind: 'error',
      problem: 'mixedAction',
    })
    expect(planDraft([createCommandTag(compact)], [compact], 1)).toMatchObject({
      kind: 'error',
      problem: 'attachments',
    })
    const tree: DiscoverableCommand = { name: 'tree', source: 'builtin' }
    expect(planDraft([createCommandTag(tree)], [tree])).toMatchObject({
      kind: 'error',
      problem: 'terminal',
    })
    expect(planDraft([createCommandTag(review)], [review], 1)).toMatchObject({
      kind: 'error',
      problem: 'attachments',
    })
  })
  it('detects commands shadowed by another runtime source', () => {
    const prompt: DiscoverableCommand = { name: 'review', source: 'prompt' }
    expect(planDraft([createCommandTag(prompt)], [review, prompt])).toMatchObject({
      kind: 'error',
      problem: 'shadowed',
    })
  })
})
