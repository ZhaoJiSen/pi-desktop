// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SessionList } from '../../src/components/SessionList'
import type { SessionSummary } from '../../src/store/sessionSelectors'

vi.mock('../../src/components/SessionRow', () => ({
  SessionRow: ({
    session,
    onMenu,
  }: {
    session: SessionSummary
    onMenu: (target: { id: string; x: number; y: number }) => void
  }) =>
    h(
      'button',
      {
        className: 'session',
        'data-id': session.id,
        onContextMenu: () => onMenu({ id: session.id, x: 0, y: 0 }),
      },
      session.title,
    ),
}))
let root: Root, container: HTMLDivElement
const items: SessionSummary[] = Array.from({ length: 200 }, (_, index) => ({
  id: `session-${index}`,
  projectId: 'project',
  title: `Chat ${index}`,
  updatedAt: index,
}))
const onMenu = vi.fn(),
  onRemove = vi.fn()
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(280)
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(6800)
  vi.spyOn(Element.prototype, 'scrollTo').mockImplementation(function (
    this: Element,
    options?: ScrollToOptions | number,
  ) {
    if (typeof options === 'object') this.scrollTop = options.top ?? 0
    this.dispatchEvent(new Event('scroll'))
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  onMenu.mockClear()
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function mount(entries = items) {
  await act(async () =>
    root.render(
      h(
        'div',
        { className: 'projects' },
        h(SessionList, {
          items: entries,
          active: null,
          running: null,
          locked: false,
          onMenu,
          onRemove,
        }),
      ),
    ),
  )
}
it('bounds mounted rows and reaches the last item through keyboard navigation', async () => {
  await mount()
  expect(container.querySelectorAll('.session').length).toBeGreaterThan(0)
  expect(container.querySelectorAll('.session').length).toBeLessThan(30)
  const first = container.querySelector<HTMLElement>('.session')!
  await act(async () => {
    first.focus()
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    await new Promise((r) => setTimeout(r, 40))
  })
  expect(document.activeElement?.getAttribute('data-id')).toBe('session-199')
  expect(container.querySelectorAll('.session').length).toBeLessThan(30)
  await act(async () => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    )
    await new Promise((r) => setTimeout(r, 40))
  })
  expect(document.activeElement?.getAttribute('data-id')).toBe('session-0')
})
it('retains a context-menu opener when scrolled away and follows its id after reordering', async () => {
  await mount()
  await act(async () =>
    container
      .querySelector('.session')!
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
  )
  expect(onMenu).toHaveBeenCalledWith({ id: 'session-0', x: 0, y: 0 })
  const viewport = container.querySelector<HTMLElement>('.projects')!
  await act(async () => {
    viewport.scrollTop = 6000
    viewport.dispatchEvent(new Event('scroll'))
  })
  expect(container.querySelector('[data-id="session-0"]')).not.toBeNull()
  const reversed = [...items].reverse()
  await mount(reversed)
  expect(
    container.querySelector('[data-id="session-0"]')?.parentElement?.getAttribute('aria-posinset'),
  ).toBe('200')
  expect(container.querySelectorAll('.session').length).toBeLessThan(35)
})

it('updates the virtual offset when an earlier group changes height', async () => {
  let top = 0
  const observed: { callback: ResizeObserverCallback; targets: Element[] }[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      readonly record: (typeof observed)[number]
      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, targets: [] }
        observed.push(this.record)
      }
      observe(target: Element) {
        this.record.targets.push(target)
      }
      unobserve() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return {
      top: this.className === 'virtual-session-list' ? top : 0,
      left: 0,
      right: 280,
      bottom: 400,
      width: 280,
      height: 400,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect
  })
  await mount()
  const viewport = container.querySelector<HTMLElement>('.projects')!
  top = 2000
  await act(async () => {
    for (const item of observed)
      if (item.targets.includes(viewport)) item.callback([], {} as ResizeObserver)
    viewport.scrollTop = 2000
    viewport.dispatchEvent(new Event('scroll'))
  })
  expect(container.querySelector('[data-session-index="0"]')).not.toBeNull()
  expect(container.querySelectorAll('.session').length).toBeLessThan(30)
})
