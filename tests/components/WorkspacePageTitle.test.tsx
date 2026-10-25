// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Page } from '../../src/router/paths'

vi.mock('@tanstack/react-router', () => ({ Outlet: () => null }))
vi.mock('../../src/router/pageComponents', () => ({
  ChatPage: () => null,
  SettingsPage: () => null,
  GitPage: () => null,
  UsagePage: () => null,
}))
vi.mock('../../src/hooks/usePaneTransition', async () => {
  const { useRef } = await import('react')
  return { usePaneTransition: () => useRef(null) }
})
vi.mock('../../src/components/WorkspacePageSkeleton', () => ({
  WorkspacePageSkeleton: () => h('div', null, 'Loading'),
}))
import { WorkspacePages } from '../../src/layouts/WorkspacePages'
import { useWorkspace } from '../../src/store/workspace'

let root: Root, container: HTMLDivElement, frames: Map<number, FrameRequestCallback>, id: number
async function show(page: Page) {
  await act(async () => root.render(h(WorkspacePages, { page })))
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
  useWorkspace.setState({ language: 'zh' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
it('keeps one title node outside the fading content and skeleton during cold and warm navigation', async () => {
  await show('commands')
  const title = container.querySelector('.workspace-page-title')!
  expect(title.querySelector('.workspace-page-label')?.textContent).toBe('指令')
  await show('extensions')
  expect(container.querySelector('.workspace-page-title')).toBe(title)
  expect(title.textContent).toBe('扩展')
  expect(title.closest('.workspace-page-content, .workspace-page-loading')).toBeNull()
  await paint()
  await paint()
  expect(container.querySelector('.workspace-page-title')).toBe(title)
  expect(container.querySelector('[data-exiting]')).not.toBeNull()
  await show('git')
  expect(container.querySelectorAll('.workspace-page-title')).toHaveLength(1)
  expect(container.querySelector('.workspace-page-title')).toBe(title)
  expect(title.textContent).toBe('Git 工作区')
  await paint()
  await paint()
  await show('commands')
  expect(container.querySelector('.workspace-page-title')).toBe(title)
  expect(title.querySelector('.workspace-page-label')?.textContent).toBe('指令')
  expect(container.querySelector('.workspace-page-loading')).toBeNull()
})
it('leaves other page headings to their own layouts', async () => {
  await show('commands')
  await show('settings')
  expect(container.querySelector('.workspace-page-title')).toBeNull()
  await show('chat')
  expect(container.querySelector('.workspace-page-title')).toBeNull()
})
