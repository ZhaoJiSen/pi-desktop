// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Page } from '../../src/router/paths'

vi.mock('../../src/components/WorkspacePageSkeleton', () => ({
  WorkspacePageSkeleton: ({ page }: { page: string }) => h('h1', null, page),
}))
import { WorkspaceLoadingOverlay } from '../../src/components/WorkspaceLoadingOverlay'

let root: Root, container: HTMLDivElement
let media: EventTarget & { matches: boolean }
async function show(pending: boolean, page: Page = 'commands') {
  await act(async () => root.render(h(WorkspaceLoadingOverlay, { page, pending })))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => media)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
it('keeps the skeleton for its fade-out instead of removing it on content commit', async () => {
  await show(true)
  const layer = container.querySelector('.workspace-page-loading')!
  expect(layer.getAttribute('data-exiting')).toBeNull()
  await show(false)
  expect(container.querySelector('.workspace-page-loading')).toBe(layer)
  expect(layer.getAttribute('aria-hidden')).toBe('true')
  expect(layer.getAttribute('data-exiting')).toBe('true')
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250))
  })
  expect(container.querySelector('.workspace-page-loading')).toBeNull()
})
it('discards an unfinished title when another page is requested', async () => {
  await show(true)
  await show(false)
  await show(true, 'extensions')
  expect(container.querySelectorAll('.workspace-page-loading')).toHaveLength(1)
  expect(container.textContent).toBe('extensions')
  expect(container.querySelector('[data-exiting]')).toBeNull()
})
it('removes the exit immediately when reduced motion is enabled', async () => {
  await show(true)
  await show(false)
  await act(async () => {
    media.matches = true
    media.dispatchEvent(new Event('change'))
  })
  expect(container.querySelector('.workspace-page-loading')).toBeNull()
  await show(true, 'git')
  expect(container.textContent).toBe('git')
  await show(false, 'git')
  expect(container.textContent).toBe('')
})
