// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityRail } from '../../src/components/ActivityRail'
import { Sidebar } from '../../src/components/Sidebar'
import { useWorkspace } from '../../src/store/workspace'

const mocks = vi.hoisted(() => ({ page: 'chat', navigate: vi.fn() }))
vi.mock('../../src/router/hooks', () => ({ useCurrentPage: () => mocks.page }))
vi.mock('../../src/router/navigation', () => ({ navigateToPage: mocks.navigate }))
// Verify navigation semantics; browser recordings cover Motion's shared selection.
vi.mock('motion/react', async () => {
  const { createElement, Fragment } = await import('react')
  const element =
    (tag: string) =>
    ({
      initial: _initial,
      animate: _animate,
      transition: _transition,
      layoutId: _layoutId,
      ...props
    }: Record<string, unknown>) =>
      createElement(tag, props)
  return {
    motion: { nav: element('nav'), span: element('span') },
    AnimatePresence: ({ children }: { children: import('react').ReactNode }) =>
      createElement(Fragment, null, children),
  }
})
let root: Root, container: HTMLDivElement
async function mount() {
  await act(async () => root.render(createElement(ActivityRail)))
}
async function click(label: string) {
  await act(async () =>
    container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click(),
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.page = 'chat'
  useWorkspace.setState({ language: 'zh' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
describe('activity rail', () => {
  it('places the existing search action beside the Pi Desktop title in the Home sidebar', async () => {
    const search = vi.fn()
    useWorkspace.setState({ projects: [], sessions: [] })
    await act(async () =>
      root.render(
        createElement(Sidebar, {
          onSearch: search,
          onNew: vi.fn(),
          onProject: vi.fn(),
          onRename: vi.fn(),
          onRemove: vi.fn(),
        }),
      ),
    )
    expect(container.querySelector('.sidebar-title')?.textContent).toBe('Pi Desktop')
    expect(container.querySelector('.sidebar-chrome')?.textContent).not.toContain('主页')
    await click('搜索')
    expect(search).toHaveBeenCalledTimes(1)
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
  it('opens Home without creating a chat, and leaves search to the Home sidebar', async () => {
    await mount()
    await click('主页')
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('chat')
    expect(container.querySelector('[aria-label="搜索"]')).toBeNull()
  })
  it('keeps every destination available and marks the current page', async () => {
    mocks.page = 'extensions'
    await mount()
    expect(container.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe(
      '扩展',
    )
    for (const [label, page] of [
      ['扩展', 'extensions'],
      ['命令', 'commands'],
      ['用量', 'usage'],
      ['设置', 'settings'],
    ]) {
      await click(label)
      expect(mocks.navigate).toHaveBeenLastCalledWith(page)
    }
    expect(container.querySelector('.rail-bottom [aria-label="设置"]')).not.toBeNull()
  })
})
