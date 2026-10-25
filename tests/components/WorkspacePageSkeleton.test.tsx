// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WorkspacePageSkeleton } from '../../src/components/WorkspacePageSkeleton'
import { SidebarWidthProvider } from '../../src/layouts/SidebarLayout'
import type { Page } from '../../src/router/paths'

let root: Root, container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
it.each([
  ['chat', '.chat-stage .chat-page .conversation-content'],
  ['git', '.git-page .git-page-body .git-view-pane'],
  ['commands', '.commands-view .commands-workspace .commands-browser'],
  ['extensions', '.packages-view .package-workspace .package-library'],
  ['settings', '.settings-workspace .settings-split .settings-navigation'],
  ['usage', '.usage-view .usage-content .usage-body .usage-overview'],
] as [Page, string][])('uses the real %s layout and HeroUI skeletons', async (page, selector) => {
  await act(async () =>
    root.render(h(SidebarWidthProvider, { children: h(WorkspacePageSkeleton, { page }) })),
  )
  expect(container.querySelector(selector)).not.toBeNull()
  expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
  expect(container.querySelector('[data-skeleton-page]')?.getAttribute('role')).toBe('status')
  expect(container.querySelector('.workspace-skeleton-content')?.getAttribute('aria-hidden')).toBe(
    'true',
  )
})
