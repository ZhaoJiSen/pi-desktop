// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HoverScrollArea } from '../../src/components/HoverScrollArea'

let root: Root
let host: HTMLDivElement
let resize: () => void
let contentHeight: number
const disconnected = vi.fn()
async function render(extra = false) {
  await act(async () =>
    root.render(
      <HoverScrollArea className="test-scroll" label="Files">
        <div>src</div>
        {extra && <div>new file</div>}
      </HoverScrollArea>,
    ),
  )
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  contentHeight = 200
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => contentHeight)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect = disconnected
    },
  )
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  disconnected.mockClear()
})
it('adds an overlay only when directory content overflows, keeping the same viewport', async () => {
  await render()
  const viewport = host.querySelector('.hover-scroll-viewport')!
  expect(host.querySelector('.hover-scroll-track')).toBeNull()
  contentHeight = 800
  await act(async () => resize())
  const thumb = host.querySelector<HTMLElement>('.hover-scroll-thumb')!
  expect(thumb.style.height).toBe('48px')
  expect(host.querySelector('.hover-scroll-viewport')).toBe(viewport)
  expect(thumb.closest('.hover-scroll-viewport')).toBeNull()
  contentHeight = 200
  await act(async () => resize())
  expect(host.querySelector('.hover-scroll-track')).toBeNull()
})
it('tracks scrolling and keeps the viewport mounted across content updates', async () => {
  contentHeight = 800
  await render()
  const viewport = host.querySelector<HTMLElement>('.hover-scroll-viewport')!
  await act(async () => {
    viewport.scrollTop = 300
    viewport.dispatchEvent(new Event('scroll'))
  })
  expect(host.querySelector<HTMLElement>('.hover-scroll-thumb')!.style.transform).toBe(
    'translateY(72px)',
  )
  await render(true)
  expect(host.querySelector('.hover-scroll-viewport')).toBe(viewport)
  expect(viewport.scrollTop).toBe(300)
})
it('lets a dragged overlay control the actual scroll position and releases drag visibility', async () => {
  contentHeight = 800
  await render()
  const viewport = host.querySelector<HTMLElement>('.hover-scroll-viewport')!
  const thumb = host.querySelector<HTMLElement>('.hover-scroll-thumb')!
  thumb.setPointerCapture = vi.fn()
  thumb.releasePointerCapture = vi.fn()
  await act(async () =>
    thumb.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientY: 10, pointerId: 1, bubbles: true }),
    ),
  )
  expect(host.querySelector('.hover-scroll-area')!.classList.contains('is-dragging')).toBe(true)
  await act(async () =>
    thumb.dispatchEvent(
      new PointerEvent('pointermove', { clientY: 82, pointerId: 1, bubbles: true }),
    ),
  )
  expect(viewport.scrollTop).toBe(300)
  await act(async () =>
    thumb.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true })),
  )
  expect(host.querySelector('.hover-scroll-area')!.classList.contains('is-dragging')).toBe(false)
})
it('disconnects measurement when the scroll area unmounts', async () => {
  await render()
  disconnected.mockClear()
  await act(async () => root.render(null))
  expect(disconnected).toHaveBeenCalled()
})
