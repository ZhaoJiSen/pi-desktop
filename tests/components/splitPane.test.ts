// @vitest-environment happy-dom
import { act, createElement, Fragment } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarLayout, SidebarWidthProvider } from '../../src/layouts/SidebarLayout'

let root: Root, container: HTMLDivElement
let resize: ResizeObserverCallback
let mediaChange: () => void
let narrow = false
const props = {
  className: 'test-split',
  collapseAt: 600,
  label: 'Resize sidebar',
  sidebar: createElement('aside'),
  children: createElement('main'),
}
async function mount() {
  await render(createElement(SidebarLayout, props))
}
async function render(content: import('react').ReactNode) {
  await act(async () => root.render(createElement(SidebarWidthProvider, null, content)))
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
describe('shared sidebar layout', () => {
  it('captures a drag, clamps against the content width, and restores it after remount', async () => {
    await mount()
    handle().setPointerCapture = vi.fn()
    handle().releasePointerCapture = vi.fn()
    await act(async () =>
      resize([{ contentRect: { width: 700 } } as ResizeObserverEntry], {} as ResizeObserver),
    )
    await pointer('pointerdown', 280)
    await pointer('pointermove', 900)
    expect(handle().getAttribute('aria-valuenow')).toBe('340')
    await pointer('pointerup', 900)
    expect(localStorage.getItem('pi.sidebar-panel-width')).toBe('340')
    expect(container.firstElementChild?.hasAttribute('data-resizing')).toBe(false)
    await act(async () => root.unmount())
    root = createRoot(container)
    await mount()
    expect(handle().getAttribute('aria-valuenow')).toBe('340')
  })
  it('supports keyboard bounds and reset, and removes the handle in the narrow layout', async () => {
    await mount()
    await key('Home')
    expect(handle().getAttribute('aria-valuenow')).toBe('270')
    await key('ArrowLeft')
    expect(handle().getAttribute('aria-valuenow')).toBe('270')
    await key('ArrowRight')
    expect(handle().getAttribute('aria-valuenow')).toBe('280')
    await key('End')
    expect(handle().getAttribute('aria-valuenow')).toBe('480')
    await act(async () => handle().dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(localStorage.getItem('pi.sidebar-panel-width')).toBe('280')
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
    expect(handle().getAttribute('aria-valuenow')).toBe('290')
    save.mockRestore()
  })
  it('shares a width across mounted pages, including a hidden Home sidebar', async () => {
    const pages = (homeVisible: boolean) =>
      createElement(
        Fragment,
        null,
        createElement(SidebarLayout, { ...props, sidebar: homeVisible ? props.sidebar : null }),
        createElement(SidebarLayout, { ...props, className: 'extensions' }),
      )
    await render(pages(false))
    await key('ArrowRight')
    expect(handle().getAttribute('aria-valuenow')).toBe('290')
    await render(pages(true))
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(2)
    for (const separator of container.querySelectorAll('[role="separator"]'))
      expect(separator.getAttribute('aria-valuenow')).toBe('290')
    await key('ArrowRight')
    for (const separator of container.querySelectorAll('[role="separator"]'))
      expect(separator.getAttribute('aria-valuenow')).toBe('300')
    expect(localStorage.getItem('pi.sidebar-panel-width')).toBe('300')
  })
  it('preserves the shared width when hiding and restoring the sidebar', async () => {
    await mount()
    await key('ArrowRight')
    await render(createElement(SidebarLayout, { ...props, sidebar: null }))
    expect(handle()).toBeNull()
    expect(container.querySelector('main')).not.toBeNull()
    expect(container.querySelector('aside')).toBeNull()
    await mount()
    expect(handle().getAttribute('aria-valuenow')).toBe('290')
  })
  it('uses the previous Home preference once, then prioritizes the shared preference', async () => {
    localStorage.setItem('pi.home-panel-width', '310')
    localStorage.setItem('pi.extensions-panel-width', '340')
    await mount()
    expect(handle().getAttribute('aria-valuenow')).toBe('310')
    await key('ArrowRight')
    await act(async () => root.unmount())
    root = createRoot(container)
    await mount()
    expect(handle().getAttribute('aria-valuenow')).toBe('320')
  })
})
