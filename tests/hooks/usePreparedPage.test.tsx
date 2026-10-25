// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePreparedPage } from '../../src/hooks/usePreparedPage'
import type { Page } from '../../src/router/paths'

let root: Root, container: HTMLDivElement, frames: Map<number, FrameRequestCallback>, id: number
function Probe({ page }: { page: Page }) {
  const prepared = usePreparedPage(page)
  return h('output', { 'data-requested': page }, prepared)
}
async function show(page: Page) {
  await act(async () => root.render(h(Probe, { page })))
}
async function paint() {
  await act(async () => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(performance.now())
  })
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  frames = new Map()
  id = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
it('keeps initial startup immediate and gives navigation feedback a paint before heavy work', async () => {
  await show('chat')
  expect(frames.size).toBe(0)
  await show('usage')
  expect(container.querySelector('output')?.dataset.requested).toBe('usage')
  expect(container.textContent).toBe('chat')
  await paint()
  expect(container.textContent).toBe('chat')
  await paint()
  expect(container.textContent).toBe('usage')
  expect(frames.size).toBe(0)
})
it('drops interrupted destinations and reveals only the latest request', async () => {
  await show('chat')
  await show('git')
  await paint()
  await show('settings')
  await paint()
  expect(container.textContent).toBe('chat')
  await paint()
  expect(container.textContent).toBe('settings')
})
it('cancels pending work when returning to the prepared page or unmounting', async () => {
  await show('chat')
  await show('usage')
  await paint()
  await show('chat')
  expect(frames.size).toBe(0)
  await paint()
  expect(container.textContent).toBe('chat')
  await show('settings')
  await act(async () => root.unmount())
  expect(frames.size).toBe(0)
  root = createRoot(container)
})
it('returns visited pages immediately without showing another skeleton', async () => {
  await show('chat')
  await show('git')
  await paint()
  await paint()
  await show('chat')
  expect(container.textContent).toBe('chat')
  expect(frames.size).toBe(0)
  await show('git')
  expect(container.textContent).toBe('git')
  expect(frames.size).toBe(0)
  await show('settings')
  expect(container.textContent).toBe('git')
  await paint()
  await paint()
  expect(container.textContent).toBe('settings')
})
