// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SplitPane } from '../../src/components/SplitPane'

let root: Root, container: HTMLDivElement
let resize: ResizeObserverCallback
let mediaChange: () => void
let narrow = false
const props = {
  className: 'test-split',
  storageKey: 'test.split-width',
  defaultWidth: 238,
  minWidth: 200,
  maxWidth: 480,
  minContentWidth: 320,
  collapseAt: 600,
  label: 'Resize sidebar',
  children: [createElement('aside', { key: 'left' }), createElement('main', { key: 'right' })],
}
async function mount() {
  await act(async () => root.render(createElement(SplitPane, props)))
}
function handle() {
  return container.querySelector<HTMLElement>('[role="separator"]')!
}
async function key(value: string) {
  await act(async () =>
    handle().dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })),
  )
}
async function pointer(type: string, x: number) {
  await act(async () =>
    handle().dispatchEvent(
      new PointerEvent(type, { pointerId: 1, clientX: x, button: 0, bubbles: true }),
    ),
  )
}
beforeEach(() => {
  localStorage.clear()
  narrow = false
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return narrow
    },
    addEventListener: (_: string, callback: () => void) => {
      mediaChange = callback
    },
    removeEventListener: vi.fn(),
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback
      }
      observe() {}
      disconnect() {}
    },
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
describe('shared split pane', () => {
  it('captures a drag, clamps against the content width, and restores it after remount', async () => {
    await mount()
    handle().setPointerCapture = vi.fn()
    handle().releasePointerCapture = vi.fn()
    await act(async () =>
      resize([{ contentRect: { width: 700 } } as ResizeObserverEntry], {} as ResizeObserver),
    )
    await pointer('pointerdown', 238)
    await pointer('pointermove', 900)
    expect(handle().getAttribute('aria-valuenow')).toBe('380')
    await pointer('pointerup', 900)
    expect(localStorage.getItem(props.storageKey)).toBe('380')
    expect(container.firstElementChild?.hasAttribute('data-resizing')).toBe(false)
    await act(async () => root.unmount())
    root = createRoot(container)
    await mount()
    expect(handle().getAttribute('aria-valuenow')).toBe('380')
  })
  it('supports keyboard bounds and reset, and removes the handle in the narrow layout', async () => {
    await mount()
    await key('Home')
    expect(handle().getAttribute('aria-valuenow')).toBe('200')
    await key('ArrowLeft')
    expect(handle().getAttribute('aria-valuenow')).toBe('200')
    await key('ArrowRight')
    expect(handle().getAttribute('aria-valuenow')).toBe('210')
    await key('End')
    expect(handle().getAttribute('aria-valuenow')).toBe('480')
    await act(async () => handle().dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(localStorage.getItem(props.storageKey)).toBe('238')
    await act(async () => {
      narrow = true
      mediaChange()
    })
    expect(handle()).toBeNull()
    expect((container.firstElementChild as HTMLElement).style.gridTemplateColumns).toBe('')
  })
  it('continues resizing if saving the preference fails', async () => {
    await mount()
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    await key('ArrowRight')
    expect(handle().getAttribute('aria-valuenow')).toBe('248')
    save.mockRestore()
  })
})
