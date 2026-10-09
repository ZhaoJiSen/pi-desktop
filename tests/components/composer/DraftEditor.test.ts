// @vitest-environment happy-dom
import { act, createElement, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DraftEditor } from '../../../src/components/composer/DraftEditor'
import { selectEditor, editorSelection } from '../../../src/components/composer/editorDom'
import { createCommandTag, DRAFT_MIME, draftLength, draftText } from '../../../src/lib/draft'
import type { DraftNode } from '../../../src/types'
import type { DiscoverableCommand } from '../../../src/lib/commands'
// happy-dom's WAAPI cancellation rejects promises unlike a browser. These tests
// exercise editor semantics; animations are verified in the browser preview.
vi.mock('motion/react', async () => {
  const { createElement } = await import('react')
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      div: ({
        children,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        ...props
      }: Record<string, unknown>) => createElement('div', props, children as React.ReactNode),
    },
  }
})

const commands: DiscoverableCommand[] = [
  { name: 'review', source: 'extension' },
  { name: 'skill:inspect', source: 'skill' },
  { name: 'compact', source: 'builtin' },
]
let root: Root, container: HTMLDivElement, nodes: DraftNode[]
let initial: DraftNode[], catalog: DiscoverableCommand[]
const submit = vi.fn()
function Probe() {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    nodes = value
  }, [value])
  return createElement(DraftEditor, {
    value,
    commands: catalog,
    loading: false,
    catalogError: '',
    onChange: setValue,
    onSubmit: submit,
  })
}
const editor = () => container.querySelector<HTMLElement>('[role="textbox"]')!
async function mount() {
  await act(async () => root.render(createElement(Probe)))
}
async function type(value: string) {
  await act(async () => {
    const range = window.getSelection()!.getRangeAt(0)
    range.deleteContents()
    const text = document.createTextNode(value)
    range.insertNode(text)
    range.setStart(text, value.length)
    range.collapse(true)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    editor().dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }),
    )
  })
}
async function key(key: string, options: KeyboardEventInit = {}) {
  await act(async () =>
    editor().dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }),
    ),
  )
}
function clipboardEvent(name: string, clipboard: Map<string, string>) {
  const event = new Event(name, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (key: string) => clipboard.get(key) || '',
      setData: (key: string, value: string) => clipboard.set(key, value),
    },
  })
  return event
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  initial = []
  catalog = commands
  submit.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
describe('command editor interactions', () => {
  it('filters slash commands, navigates the menu and inserts a tag with Enter', async () => {
    await mount()
    await type('/')
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3)
    await key('ArrowDown')
    await key('Enter')
    expect(nodes[0]).toMatchObject({ type: 'command', name: 'skill:inspect' })
    expect(container.querySelector('.command-tag')).not.toBeNull()
    expect(container.querySelector('[role="listbox"]')).toBeNull()
    await type('/rev')
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(1)
    await key('Escape')
    expect(container.querySelector('[role="listbox"]')).toBeNull()
    expect(draftText(nodes)).toContain('/rev')
  })
  it('supports mouse selection, multiple tags and insertion between text', async () => {
    initial = [{ type: 'text', text: 'before  after' }]
    await mount()
    selectEditor(editor(), { start: 7, end: 7 })
    await type('/rev')
    await act(async () => container.querySelector<HTMLElement>('[role="option"]')!.click())
    expect(nodes).toMatchObject([
      { type: 'text', text: 'before ' },
      { type: 'command', name: 'review' },
      { type: 'text', text: '  after' },
    ])
    await type('/compact')
    await key('Enter')
    expect(nodes.filter((n) => n.type === 'command')).toHaveLength(2)
  })
  it('deletes adjacent tags with either key and preserves surrounding content', async () => {
    initial = [
      { type: 'text', text: 'a' },
      createCommandTag(commands[0]!),
      createCommandTag(commands[1]!),
      { type: 'text', text: 'b' },
    ]
    await mount()
    selectEditor(editor(), { start: 2, end: 2 })
    await key('Backspace')
    expect(nodes).toMatchObject([
      { type: 'text', text: 'a' },
      { type: 'command', name: 'skill:inspect' },
      { type: 'text', text: 'b' },
    ])
    await key('Delete')
    expect(nodes).toEqual([{ type: 'text', text: 'ab' }])
  })
  it('moves the caret across atomic tags and supports undo/redo', async () => {
    initial = [createCommandTag(commands[0]!), { type: 'text', text: ' text' }]
    await mount()
    selectEditor(editor(), { start: 0, end: 0 })
    await key('ArrowRight')
    expect(editorSelection(editor())).toEqual({ start: 1, end: 1 })
    await key('Backspace')
    expect(nodes.some((n) => n.type === 'command')).toBe(false)
    await key('z', { metaKey: true })
    expect(nodes[0]).toMatchObject({ type: 'command', name: 'review' })
    await key('z', { metaKey: true, shiftKey: true })
    expect(nodes).toEqual([{ type: 'text', text: ' text' }])
  })
  it('copies, cuts and pastes structured metadata with unique ids; never pastes HTML', async () => {
    initial = [createCommandTag(commands[0]!), { type: 'text', text: ' text' }]
    await mount()
    const id = initial[0]!.type === 'command' ? initial[0]!.id : ''
    selectEditor(editor(), { start: 0, end: draftLength(nodes) })
    const clipboard = new Map<string, string>()
    await act(async () => editor().dispatchEvent(clipboardEvent('copy', clipboard)))
    expect(clipboard.get(DRAFT_MIME)).toContain('"source":"extension"')
    await act(async () => editor().dispatchEvent(clipboardEvent('cut', clipboard)))
    expect(nodes).toEqual([])
    await act(async () => editor().dispatchEvent(clipboardEvent('paste', clipboard)))
    expect(nodes[0]).toMatchObject({ type: 'command', name: 'review' })
    expect((nodes[0] as { id: string }).id).not.toBe(id)
    clipboard.clear()
    clipboard.set('text/html', '<script>bad()</script>')
    clipboard.set('text/plain', 'safe')
    await act(async () => editor().dispatchEvent(clipboardEvent('paste', clipboard)))
    expect(editor().querySelector('script')).toBeNull()
    expect(draftText(nodes)).toContain('safe')
  })
  it('retains unavailable tags after the catalog changes and keeps them stable on blur', async () => {
    initial = [createCommandTag(commands[0]!), { type: 'text', text: ' retained' }]
    await mount()
    await act(async () => editor().blur())
    expect(nodes).toEqual(initial)
    catalog = []
    await mount()
    expect(container.querySelector('.command-tag.unavailable')).not.toBeNull()
    expect(nodes).toEqual(initial)
  })
  it('edits parameters on a selected tag without changing adjacent nodes', async () => {
    initial = [createCommandTag(commands[0]!), { type: 'text', text: ' retained' }]
    await mount()
    await act(async () => container.querySelector<HTMLElement>('.command-tag')!.click())
    await act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((b) => b.textContent === 'Edit command')!
        .click(),
    )
    const input = container.querySelector<HTMLInputElement>('.command-edit input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'main')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => container.querySelector<HTMLButtonElement>('[data-save]')!.click())
    expect(nodes[0]).toMatchObject({ arguments: 'main' })
    expect(nodes[1]).toEqual({ type: 'text', text: ' retained' })
  })
  it('does not trigger inside code or URLs, or submit during IME composition', async () => {
    await mount()
    await type('https://example.com/')
    expect(container.querySelector('[role="listbox"]')).toBeNull()
    await act(async () =>
      editor().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })),
    )
    await key('Enter', { metaKey: true, isComposing: true })
    expect(submit).not.toHaveBeenCalled()
    await act(async () =>
      editor().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })),
    )
    await key('Enter', { metaKey: true })
    expect(submit).toHaveBeenCalledOnce()
  })
})
