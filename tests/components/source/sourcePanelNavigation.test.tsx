// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SourcePanel } from '../../../src/components/source/SourcePanel'
import { OpenSourceButton } from '../../../src/components/source/OpenSourceButton'
import { SourceProvider, useSource } from '../../../src/components/source/context'
import { navigateToPage } from '../../../src/router/navigation'
import * as api from '../../../src/lib/source/api'
import { useWorkspace } from '../../../src/store/workspace'
import type { ToolBlock } from '../../../src/types'

vi.mock('../../../src/router/navigation', () => ({ navigateToPage: vi.fn() }))

const project = vi.hoisted(() => ({
  path: '/project',
  name: 'Project',
  revision: '1',
  agent: new Set<string>(),
}))
vi.mock('../../../src/components/source/useProjectSource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/components/source/useProjectSource')>()),
  useProjectSource: () => project,
}))
vi.mock('../../../src/components/source/PanelResize', () => ({ PanelResize: () => null }))
vi.mock('../../../src/components/source/CommitBranchDialog', () => ({
  CommitBranchDialog: () => null,
}))
vi.mock('../../../src/components/source/LoadedDiff', () => ({
  LoadedDiff: ({ path, revision }: { path: string; revision?: string }) => (
    <div className="test-diff" data-path={path} data-revision={revision} />
  ),
}))
vi.mock('../../../src/components/source/FileViewer', () => ({
  FileViewer: ({
    path,
    onDiff,
    onHistory,
  }: {
    path: string
    onDiff: () => void
    onHistory: () => void
  }) => (
    <div className="test-file" data-path={path}>
      <button onClick={onDiff}>show-file-diff</button>
      <button onClick={onHistory}>show-file-history</button>
    </div>
  ),
}))
const status = {
  available: true,
  repo: true,
  branch: 'main',
  truncated: false,
  files: ['src/a.ts', 'src/b.ts'].map((path) => ({
    path,
    code: 'M',
    staged: false,
    unstaged: true,
  })),
}
const commits = ['first', 'second'].map((hash) => ({
  hash,
  parents: [],
  author: 'Ari',
  timestamp: 1760400000,
  refs: '',
  subject: `${hash} commit`,
}))
function tool(path: string): ToolBlock {
  return {
    type: 'tool',
    id: path,
    name: 'edit',
    label: path,
    args: { path },
    status: 'done',
    output: '',
  }
}
function Controls() {
  const source = useSource()!
  return (
    <>
      <output
        className="workspace-request"
        data-path={source.workspaceRequest.path ?? ''}
        data-history={source.workspaceRequest.historyPath ?? ''}
      />
      <span className="tool-a">
        <OpenSourceButton tool={tool('src/a.ts')} />
      </span>
      <span className="tool-b">
        <OpenSourceButton tool={tool('src/b.ts')} />
      </span>
      <button onClick={() => source.show({ tab: 'files', path: 'src/a.ts', mode: 'view' })}>
        view-a
      </button>
      <SourcePanel
        width={760}
        maxWidth={1200}
        expanded={false}
        onWidth={() => {}}
        onShowConversation={() => {}}
      />
    </>
  )
}
function Harness() {
  return (
    <SourceProvider>
      <Controls />
    </SourceProvider>
  )
}
let root: Root, container: HTMLDivElement
const active = () => container.querySelector<HTMLElement>('.source-workspace-pane:not([hidden])')!
const node = (selector: string) => container.querySelector<HTMLElement>(selector)!
const currentDiff = () => active().querySelector<HTMLElement>('.test-diff')!
function row(path: string) {
  return [...active().querySelectorAll<HTMLElement>('.source-tree-item')].find(
    (element) =>
      element.querySelector('.source-tree-name')?.getAttribute('data-source-path') === path,
  )!
}
async function click(selector: string | HTMLElement) {
  const element = typeof selector === 'string' ? node(selector) : selector
  expect(element).toBeTruthy()
  await act(async () => element.click())
}
async function clickText(text: string) {
  const element = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (el) => el.textContent === text,
  )!
  await click(element)
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
  vi.useFakeTimers()
  project.path = '/project'
  useWorkspace.setState({ language: 'en' })
  vi.spyOn(api, 'gitStatus').mockResolvedValue(status)
  vi.spyOn(api, 'listProjectDirectory').mockImplementation(async (_, relative = '') => ({
    truncated: false,
    ignorePartial: false,
    entries: relative
      ? ['a.ts', 'b.ts', 'unchanged.ts'].map((name) => ({
          name,
          path: `src/${name}`,
          kind: 'file' as const,
        }))
      : [{ name: 'src', path: 'src', kind: 'dir' as const }],
  }))
  vi.spyOn(api, 'gitLog').mockResolvedValue({ available: true, repo: true, commits })
  vi.spyOn(api, 'gitCommitFiles').mockImplementation(async (_, hash) => ({
    available: true,
    repo: true,
    hash,
    files: [{ path: hash === 'first' ? 'src/a.ts' : 'src/b.ts', code: 'M' }],
  }))
  vi.spyOn(api, 'gitRestoreFile').mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('source workspace navigation', () => {
  it('keeps the selected file and reading position when the changed-files tree is hidden', async () => {
    await click('.tool-a button')
    await click(row('src/b.ts'))
    const tree = active().querySelector('.source-tree')
    const diff = currentDiff()
    const scroll = active().querySelector<HTMLElement>('.source-scroll')!
    const navigation = active().querySelector<HTMLElement>('.source-browser-navigation')!
    scroll.scrollTop = 120
    const action = (label: string) =>
      active().querySelector<HTMLElement>(`button[aria-label="${label}"]`)!
    await click(action('Hide changed files'))
    expect(navigation.hidden).toBe(true)
    expect(currentDiff()).toBe(diff)
    expect(scroll.scrollTop).toBe(120)
    await click(action('Show changed files'))
    expect(navigation.hidden).toBe(false)
    expect(active().querySelector('.source-tree')).toBe(tree)
    expect(row('src/b.ts').classList.contains('is-current')).toBe(true)
    expect(currentDiff().dataset.path).toBe('src/b.ts')
    expect(scroll.scrollTop).toBe(120)
  })

  it('keeps loaded diff, navigation, and scroll position on repeated tool requests', async () => {
    await click('.tool-a button')
    const scroll = active().querySelector<HTMLElement>('.source-scroll')!
    const tree = active().querySelector('.source-tree')
    const diff = currentDiff()
    scroll.scrollTop = 120
    await click('.tool-a button')
    await click('.tool-a button')
    expect(active().querySelector('.source-scroll')).toBe(scroll)
    expect(active().querySelector('.source-tree')).toBe(tree)
    expect(currentDiff()).toBe(diff)
    expect(scroll.scrollTop).toBe(120)
    expect(api.gitStatus).toHaveBeenCalledTimes(1)
  })
  it('does not restart a pending status request', async () => {
    let resolve!: (value: typeof status) => void
    vi.mocked(api.gitStatus).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    await click('.tool-a button')
    await click('.tool-a button')
    expect(api.gitStatus).toHaveBeenCalledTimes(1)
    await act(async () => resolve(status))
    expect(currentDiff().dataset.path).toBe('src/a.ts')
  })
  it('switches the selected diff without replacing its tree or reading all project files', async () => {
    await click('.tool-a button')
    const tree = active().querySelector('.source-tree')
    await click(row('src/b.ts'))
    expect(currentDiff().dataset.path).toBe('src/b.ts')
    expect(active().querySelector('.source-tree')).toBe(tree)
    expect(row('src/b.ts').classList.contains('is-current')).toBe(true)
    expect(api.listProjectDirectory).not.toHaveBeenCalled()
    expect(api.gitStatus).toHaveBeenCalledTimes(1)
  })
  it('reveals a requested file inside a manually collapsed directory', async () => {
    await click('.tool-a button')
    await click(row('src'))
    expect(row('src').getAttribute('aria-expanded')).toBe('false')
    await click('.tool-a button')
    expect(row('src').getAttribute('aria-expanded')).toBe('true')
    expect(row('src/a.ts')).toBeTruthy()
  })
  it('keeps the full file tree mounted while selecting files and switching between Git and Files', async () => {
    await clickText('view-a')
    const tree = active().querySelector('.source-tree')
    const viewport = active().querySelector<HTMLElement>('.hover-scroll-viewport')!
    viewport.scrollTop = 90
    await click(row('src/b.ts'))
    expect(active().querySelector('.test-file')?.getAttribute('data-path')).toBe('src/b.ts')
    expect(active().querySelector('.source-tree')).toBe(tree)
    expect(row('src/unchanged.ts')).toBeTruthy()
    await click('[role="tab"][aria-label="Git"]')
    await click('[role="tab"][aria-label="Files"]')
    expect(active().querySelector('.source-tree')).toBe(tree)
    expect(viewport.scrollTop).toBe(90)
    expect(active().querySelector('.test-file')?.getAttribute('data-path')).toBe('src/b.ts')
    expect(active().textContent).not.toContain('Back')
    await clickText('view-a')
    expect(active().querySelector('.test-file')?.getAttribute('data-path')).toBe('src/a.ts')
  })
  it('routes a file diff to Git while retaining the file browser selection', async () => {
    await clickText('view-a')
    await clickText('show-file-diff')
    expect(node('[role="tab"][aria-label="Git"]').getAttribute('aria-selected')).toBe('true')
    expect(currentDiff().dataset.path).toBe('src/a.ts')
    await click('[role="tab"][aria-label="Files"]')
    expect(active().querySelector('.test-file')?.getAttribute('data-path')).toBe('src/a.ts')
  })
  it('offers basic Git viewing and opens the full workspace from its toolbar', async () => {
    await click('.tool-a button')
    expect(container.querySelector('[role="tab"][aria-label="History"]')).toBeNull()
    expect(active().querySelector('button[aria-label="Discard changes"]')).toBeNull()
    expect(
      [...active().querySelectorAll('button')].some(
        (el) => el.textContent === 'Create branch & commit' && !el.hidden,
      ),
    ).toBe(false)
    await click(row('src/b.ts'))
    await click('button[aria-label="Open Git workspace"]')
    expect(node('.workspace-request').dataset.path).toBe('src/b.ts')
    expect(navigateToPage).toHaveBeenLastCalledWith('git')
    expect(api.gitLog).not.toHaveBeenCalled()
  })
  it('opens file history in the full Git workspace while retaining the sidebar file', async () => {
    await clickText('view-a')
    await clickText('show-file-history')
    expect(navigateToPage).toHaveBeenLastCalledWith('git')
    expect(api.gitLog).not.toHaveBeenCalled()
    expect(node('.workspace-request').dataset.history).toBe('src/a.ts')
    expect(active().querySelector('.test-file')?.getAttribute('data-path')).toBe('src/a.ts')
  })
  it('keeps the navigation mounted across closing and reopening the workspace', async () => {
    await click('.tool-a button')
    const tree = active().querySelector('.source-tree')
    await click('button[aria-label="Close"]')
    await act(async () => vi.advanceTimersByTime(300))
    expect(container.querySelector('.source-panel')?.hasAttribute('hidden')).toBe(true)
    await click('.tool-a button')
    expect(active().querySelector('.source-tree')).toBe(tree)
    expect(api.gitStatus).toHaveBeenCalledTimes(1)
  })
  it('keeps all project files available outside a Git repository', async () => {
    vi.mocked(api.gitStatus).mockResolvedValue({ ...status, repo: false, branch: null, files: [] })
    await clickText('view-a')
    expect(row('src/unchanged.ts')).toBeTruthy()
    expect(active().querySelector('.test-file')?.getAttribute('data-path')).toBe('src/a.ts')
    await click('[role="tab"][aria-label="Git"]')
    expect(active().textContent).toContain('not a Git repository')
    await click('[role="tab"][aria-label="Files"]')
    expect(row('src/unchanged.ts')).toBeTruthy()
  })
  it('refreshes explicitly and resets the workspace when changing projects', async () => {
    await click('.tool-a button')
    const tree = active().querySelector('.source-tree')
    await click('button[aria-label="Refresh"]')
    expect(api.gitStatus).toHaveBeenCalledTimes(2)
    expect(active().querySelector('.source-tree')).toBe(tree)
    project.path = '/other-project'
    await act(async () => root.render(<Harness />))
    expect(api.gitStatus).toHaveBeenLastCalledWith('/other-project')
    expect(active().querySelector('.source-tree')).not.toBe(tree)
  })
})
