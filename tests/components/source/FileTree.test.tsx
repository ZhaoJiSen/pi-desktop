// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileTree } from '../../../src/components/source/FileTree'
import * as api from '../../../src/lib/source/api'
import type { DirectoryListing } from '../../../src/lib/source/types'
import { useWorkspace } from '../../../src/store/workspace'

vi.mock('../../../src/lib/source/api', () => ({ listProjectDirectory: vi.fn() }))
let root: Root
let host: HTMLDivElement
const onOpen = vi.fn()
const listing = (entries: DirectoryListing['entries']): DirectoryListing => ({
  entries,
  truncated: false,
  ignorePartial: false,
})
const directories: Record<string, DirectoryListing> = {
  '': listing([
    { name: 'src', path: 'src', kind: 'dir' },
    { name: 'package.json', path: 'package.json', kind: 'file' },
    { name: 'linked', path: 'linked', kind: 'link' },
  ]),
  src: listing([
    { name: 'components', path: 'src/components', kind: 'dir' },
    { name: 'App.tsx', path: 'src/App.tsx', kind: 'file' },
  ]),
  'src/components': listing([
    { name: 'Button.tsx', path: 'src/components/Button.tsx', kind: 'file' },
  ]),
}
async function render(expand?: string, tick = 0) {
  await act(async () =>
    root.render(
      <FileTree
        projectPath="/project"
        tick={tick}
        expand={expand}
        marks={new Map([['src/App.tsx', 'M']])}
        agent={new Set(['src/App.tsx'])}
        onOpen={onOpen}
      />,
    ),
  )
}
function row(name: string) {
  return [...host.querySelectorAll<HTMLElement>('.source-tree-item')].find(
    (item) => item.querySelector('.source-tree-name')?.textContent === name,
  )!
}
async function click(element: Element) {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  useWorkspace.setState({ language: 'en' })
  vi.mocked(api.listProjectDirectory).mockImplementation(
    async (_, relative = '') => directories[relative] ?? listing([]),
  )
  onOpen.mockClear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
describe('source file tree', () => {
  it('loads only expanded directories and keeps library tree semantics', async () => {
    await render()
    expect(host.querySelector('[role="treegrid"]')).toBeTruthy()
    expect(api.listProjectDirectory).toHaveBeenCalledTimes(1)
    await click(row('src'))
    expect(row('src').getAttribute('aria-expanded')).toBe('true')
    expect(row('App.tsx')).toBeTruthy()
    expect(api.listProjectDirectory).toHaveBeenCalledTimes(2)
    await click(row('src').querySelector('button')!)
    expect(row('src').getAttribute('aria-expanded')).toBe('false')
    expect(row('App.tsx')).toBeUndefined()
  })
  it('opens files with one action and preserves git and agent marks', async () => {
    await render('src')
    expect(row('App.tsx').textContent).toContain('MAgent')
    await click(row('App.tsx'))
    expect(onOpen).toHaveBeenCalledExactlyOnceWith('src/App.tsx')
    expect(row('package.json').querySelector('svg')).toBeTruthy()
    expect(row('linked').getAttribute('aria-disabled')).toBe('true')
    await click(row('linked'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
  it('supports keyboard expansion before a directory has loaded', async () => {
    await render()
    const directory = row('src')
    expect(directory.getAttribute('aria-expanded')).toBe('false')
    await act(async () => {
      directory.focus()
      directory.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(row('App.tsx')).toBeTruthy()
    expect(directory.getAttribute('aria-expanded')).toBe('true')
    await act(async () => {
      directory.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    })
    expect(directory.getAttribute('aria-expanded')).toBe('false')
  })
  it('expands every ancestor when navigating to a directory', async () => {
    await render()
    await render('src/components')
    expect(row('src').getAttribute('aria-expanded')).toBe('true')
    expect(row('components').getAttribute('aria-expanded')).toBe('true')
    expect(row('Button.tsx').getAttribute('aria-level')).toBe('3')
  })
  it('refreshes visible listings without collapsing the tree', async () => {
    await render('src')
    const node = row('src')
    await render('src', 1)
    expect(row('src')).toBe(node)
    expect(node.getAttribute('aria-expanded')).toBe('true')
    expect(api.listProjectDirectory).toHaveBeenCalledTimes(4)
  })
  it('shows nested load failures and allows retry by reopening', async () => {
    vi.mocked(api.listProjectDirectory).mockImplementation(async (_, relative = '') => {
      if (relative) throw new Error('Cannot read directory')
      return directories['']!
    })
    await render('src')
    expect(host.textContent).toContain('Cannot read directory')
    await click(row('src'))
    vi.mocked(api.listProjectDirectory).mockImplementation(
      async (_, relative = '') => directories[relative]!,
    )
    await click(row('src'))
    expect(row('App.tsx')).toBeTruthy()
  })
  it('keeps the selected file visible when a zoomed viewport is resized', async () => {
    let viewportHeight = 100
    let bottom = 236
    let resize: (() => void) | undefined
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(element: Element) {
          if (element === host) resize = () => this.callback([], this as unknown as ResizeObserver)
        }
        unobserve() {}
        disconnect = disconnect
      },
    )
    host.className = 'hover-scroll-viewport'
    Object.defineProperty(host, 'clientHeight', { get: () => viewportHeight })
    const scroll = vi.spyOn(host, 'scrollTo').mockImplementation(() => {})
    const original = HTMLElement.prototype.getBoundingClientRect
    const geometry = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this === host)
          return { top: 0, bottom: viewportHeight * 2, height: viewportHeight * 2 } as DOMRect
        if (this.classList.contains('source-tree-content') && this.textContent === 'package.json')
          return { top: bottom - 56, bottom, height: 56 } as DOMRect
        return original.call(this)
      })
    try {
      await act(async () =>
        root.render(
          <FileTree
            projectPath="/project"
            tick={0}
            selected="package.json"
            marks={new Map()}
            agent={new Set()}
            onOpen={onOpen}
          />,
        ),
      )
      expect(scroll).toHaveBeenLastCalledWith({ top: 18 })
      viewportHeight = 80
      bottom = 216
      act(() => resize?.())
      expect(scroll).toHaveBeenLastCalledWith({ top: 28 })
      await act(async () => root.unmount())
      expect(disconnect).toHaveBeenCalled()
      root = createRoot(host)
    } finally {
      geometry.mockRestore()
      scroll.mockRestore()
    }
  })
  it('shows the empty state for an empty project', async () => {
    vi.mocked(api.listProjectDirectory).mockResolvedValue(listing([]))
    await render()
    expect(host.querySelector('.source-notice')).toBeTruthy()
    expect(host.querySelector('[role="treegrid"]')).toBeNull()
  })
})
