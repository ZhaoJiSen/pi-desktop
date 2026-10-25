// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GitFileList } from '../../../src/components/source/GitFileList'

// Only measurements are substituted; exercise HeroUI's real mouse/keyboard handlers.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, start: index * 52, size: 48 })),
    getTotalSize: () => count * 52,
    scrollToIndex: () => {},
  }),
}))
const files = ['src/component.vue', 'tests/test.mjs'].map((path) => ({ path, code: 'M' }))
const select = vi.fn()
let root: Root
let container: HTMLDivElement
function Harness() {
  const [selected, setSelected] = useState<string | null>(files[0]!.path)
  return (
    <GitFileList
      files={files}
      selected={selected}
      label="Changed files"
      onSelect={(path) => {
        select(path)
        setSelected(path)
      }}
    />
  )
}
async function mouseClick(target: HTMLElement) {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
      }),
    )
    target.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
      }),
    )
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, button: 0 }))
  })
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  select.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
it('opens another file on one mouse click and reopens the selected file on another click', async () => {
  const target = container.querySelectorAll<HTMLElement>('[role="option"]')[1]!
  await mouseClick(target)
  expect(select.mock.calls).toEqual([[files[1]!.path]])
  expect(target.getAttribute('aria-selected')).toBe('true')
  await mouseClick(target)
  expect(select.mock.calls).toEqual([[files[1]!.path], [files[1]!.path]])
  expect(target.getAttribute('aria-selected')).toBe('true')
})
it('opens files through keyboard navigation and Enter', async () => {
  const first = container.querySelector<HTMLElement>('[role="option"]')!
  await act(async () => {
    first.focus()
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  })
  expect(select).toHaveBeenLastCalledWith(files[1]!.path)
  const target = container.querySelectorAll<HTMLElement>('[role="option"]')[1]!
  select.mockClear()
  await act(async () => {
    target.focus()
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
  })
  expect(select).toHaveBeenCalledWith(files[1]!.path)
})
it('moves focus with the selection when clicking a nested filename', async () => {
  const options = container.querySelectorAll<HTMLElement>('[role="option"]')
  await act(async () => options[0]!.focus())
  await mouseClick(options[1]!.querySelector<HTMLElement>('.git-file-label > span')!)
  expect(options[0]!.getAttribute('aria-selected')).toBe('false')
  expect(options[1]!.getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(options[1])
  expect(options[0]!.hasAttribute('data-focused')).toBe(false)
})
