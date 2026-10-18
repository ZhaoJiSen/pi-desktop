// @vitest-environment happy-dom
import { act, createElement, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComposerInput } from '../../../src/components/composer/ComposerInput'
import { createCommandTag, draftFromText, draftText, planDraft } from '../../../src/lib/draft'
import type { DraftNode } from '../../../src/types'
import type { DiscoverableCommand } from '../../../src/lib/commands'

const commands: DiscoverableCommand[] = [
  { name: 'review', source: 'extension', sourceInfo: { source: 'npm:review' } },
  { name: 'skill:inspect', source: 'skill' },
  { name: 'model', source: 'builtin' },
  { name: 'login', source: 'builtin' },
]
let root: Root, container: HTMLDivElement
const submit = vi.fn()
function Probe() {
  const [value, setValue] = useState<DraftNode[]>([
    createCommandTag(commands[1]!),
    { type: 'text', text: ' check errors' },
  ])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  return (
    <div className="composer-shell" ref={anchorRef}>
      <ComposerInput
        value={value}
        commands={commands}
        loading={false}
        catalogError=""
        onChange={setValue}
        onSubmit={submit}
        inputRef={inputRef}
        anchorRef={anchorRef}
        placement="top start"
        focusVersion={0}
      />
    </div>
  )
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  submit.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(createElement(Probe)))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
async function key(key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
  await act(async () => container.querySelector('textarea')!.dispatchEvent(event))
  return event
}
describe('native composer input', () => {
  it('shows legacy command drafts as editable native textarea text', () => {
    const input = container.querySelector('textarea')!
    expect(input.value).toBe('/skill:inspect check errors')
    expect(input.dataset.slot).toBe('textarea')
    expect(container.querySelector('[contenteditable]')).toBeNull()
  })
  it('leaves line breaks and IME Enter to the browser, submits ordinary Enter', async () => {
    expect((await key('Enter', { shiftKey: true })).defaultPrevented).toBe(false)
    expect((await key('Enter', { isComposing: true })).defaultPrevented).toBe(false)
    expect(submit).not.toHaveBeenCalled()
    expect((await key('Enter')).defaultPrevented).toBe(true)
    expect(submit).toHaveBeenCalledOnce()
  })
})
describe('plain text command migration', () => {
  it('preserves command dispatch and exact visible parameters', () => {
    const value = draftFromText('/review src/main.ts\nCheck edge cases.', commands)
    expect(draftText(value)).toBe('/review src/main.ts\nCheck edge cases.')
    expect(planDraft(value, commands, 0)).toEqual({
      kind: 'prompt',
      message: '/review src/main.ts\nCheck edge cases.',
    })
    expect(planDraft(draftFromText('/model', commands), commands, 0)).toEqual({
      kind: 'navigate',
      name: 'model',
    })
    expect(planDraft(draftFromText('/login', commands), commands, 0)).toEqual({
      kind: 'error',
      problem: 'terminal',
      name: 'login',
    })
  })
  it('keeps unavailable selected commands visible and rejects dispatch', () => {
    const previous = [createCommandTag(commands[0]!)]
    const value = draftFromText('/review current changes', [], previous)
    expect(draftText(value)).toBe('/review current changes')
    expect(planDraft(value, [], 0)).toEqual({
      kind: 'error',
      problem: 'unavailable',
      name: 'review',
    })
  })
  it('leaves ordinary paths and code blocks as text', () => {
    for (const text of ['/usr/local/bin', '```\n/model\n```', 'Explain /model'])
      expect(draftFromText(text, commands)).toEqual([{ type: 'text', text }])
  })
})
