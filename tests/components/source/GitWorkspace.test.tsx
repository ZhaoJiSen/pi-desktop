// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitHistoryWorkspace } from '../../../src/components/source/GitHistoryWorkspace'
import { GitBranchActions } from '../../../src/components/source/GitBranchActions'
import { ChangesPane } from '../../../src/components/source/ChangesView'
import { SourceProvider, useSource } from '../../../src/components/source/context'
import { ProjectSourceContext } from '../../../src/components/source/useProjectSource'
import { navigateToPage } from '../../../src/router/navigation'
import {
  GitFileNavigator,
  GitQuickFind,
  useFileSearch,
} from '../../../src/components/source/GitFileNavigator'
import * as api from '../../../src/lib/source/api'
import { useWorkspace } from '../../../src/store/workspace'
import type { GitCommit } from '../../../src/lib/source/types'

vi.mock('../../../src/router/navigation', () => ({ navigateToPage: vi.fn() }))
// Exercise search state and focus independently of Happy DOM's partial animation API.
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react')
  const { forwardRef } = await import('react')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      ...actual.motion,
      div: forwardRef<HTMLDivElement, Record<string, unknown>>(function MotionDiv(
        {
          children,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          ...props
        },
        ref,
      ) {
        return (
          <div ref={ref} {...props}>
            {children as React.ReactNode}
          </div>
        )
      }),
    },
  }
})

// Test application selection and requests independently of browser measurements.
// The actual virtualizer, keyboard separator and persistence are checked in the browser.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number
    estimateSize: (index: number) => number
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * estimateSize(index),
        size: estimateSize(index),
      })),
    getTotalSize: () => (count ? count * estimateSize(0) : 0),
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
    getVirtualItemForOffset: () => ({ index: 0 }),
    scrollOffset: 0,
  }),
}))
vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Separator: () => <div />,
  useDefaultLayout: () => ({}),
}))
vi.mock('../../../src/components/source/LoadedDiff', () => ({
  LoadedDiff: ({ path, revision }: { path: string; revision: string }) => (
    <div className="test-diff" data-path={path} data-revision={revision} />
  ),
}))
const commits: GitCommit[] = [
  {
    hash: 'aaaa1111',
    parents: ['bbbb2222'],
    author: 'Ari',
    timestamp: 1760400000,
    refs: 'HEAD -> main',
    subject: 'First change',
  },
  {
    hash: 'bbbb2222',
    parents: [],
    author: 'Mina',
    timestamp: 1760300000,
    refs: 'feature',
    subject: 'Second change',
  },
]
let root: Root, container: HTMLDivElement
async function mount(node: React.ReactNode) {
  await act(async () => root.render(node))
}
async function click(element: Element | null | undefined) {
  expect(element).toBeTruthy()
  await act(async () => (element as HTMLElement).click())
}
function button(text: string) {
  return [...container.querySelectorAll('button')].find((el) => el.textContent === text)
}
async function fill(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
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
  useWorkspace.setState({ language: 'en', gitChangesView: 'tree' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  vi.spyOn(api, 'gitBranches').mockResolvedValue([
    { name: 'main', tip: 'aaaa1111', current: true, remote: false },
    { name: 'feature', tip: 'bbbb2222', current: false, remote: false },
  ])
  vi.spyOn(api, 'gitLogPage').mockImplementation(async (_, _relative, tip, skip = 0) => ({
    available: true,
    repo: true,
    commits: skip ? [commits[1]!] : tip === 'bbbb2222' ? [commits[1]!] : [commits[0]!],
    hasMore: !tip && skip === 0,
  }))
  vi.spyOn(api, 'gitCommitFiles').mockImplementation(async (_, hash) => ({
    available: true,
    repo: true,
    hash,
    files: [{ path: hash === 'aaaa1111' ? 'src/a.ts' : 'src/b.ts', code: 'M' }],
  }))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const history = (path: string | null = null) => (
  <GitHistoryWorkspace
    navigation={<nav>Git views</nav>}
    projectPath="/project"
    tick={0}
    historyPath={path}
  />
)
describe('Git workspace', () => {
  it('uses the same directory-first order for the file tree, initial selection and continuous diffs', async () => {
    const paths = ['src/App.vue', 'src/settings.js', 'src/store/modules/table.js']
    vi.spyOn(api, 'gitStatus').mockResolvedValue({
      available: true,
      repo: true,
      branch: 'main',
      truncated: false,
      files: paths.map((path) => ({ path, code: 'M', staged: false, unstaged: true })),
    })
    await mount(
      <ProjectSourceContext.Provider value={{ path: '/project', name: 'Project' }}>
        <ChangesPane workspace tick={0} requestNonce={0} initialPath={null} fallbackLabel="" />
      </ProjectSourceContext.Provider>,
    )
    const expected = ['src/store/modules/table.js', 'src/App.vue', 'src/settings.js']
    const treePaths = [...container.querySelectorAll('.source-tree-name')]
      .map((item) => item.getAttribute('title'))
      .filter((path) => paths.includes(path!))
    expect(treePaths).toEqual(expected)
    expect(
      [...container.querySelectorAll('[data-diff-path]')].map((item) =>
        item.getAttribute('data-diff-path'),
      ),
    ).toEqual(expected)
    expect(
      container
        .querySelector('.source-tree-item.is-current .source-tree-name')
        ?.getAttribute('title'),
    ).toBe(expected[0])
  })
  it('opens the exposed discard action confirmation without mutating on selection', async () => {
    vi.spyOn(api, 'gitStatus').mockResolvedValue({
      available: true,
      repo: true,
      branch: 'main',
      truncated: false,
      files: [{ path: 'src/other.ts', code: 'M', staged: false, unstaged: true }],
    })
    const restore = vi.spyOn(api, 'gitRestoreFile').mockResolvedValue()
    await mount(
      <ProjectSourceContext.Provider value={{ path: '/project', name: 'Project' }}>
        <ChangesPane workspace tick={0} requestNonce={0} initialPath={null} fallbackLabel="" />
      </ProjectSourceContext.Provider>,
    )
    await click(container.querySelector('button[aria-label="Discard changes"]'))
    expect(container.querySelector('.source-restore')).not.toBeNull()
    expect(container.querySelector('.git-file-trigger')?.getAttribute('aria-expanded')).toBe('true')
    expect(restore).not.toHaveBeenCalled()
    await click(button('Cancel'))
    expect(container.querySelector('.source-restore')).toBeNull()
    expect(restore).not.toHaveBeenCalled()
  })
  it('keeps all file diffs in the review when a navigation file is selected', async () => {
    vi.spyOn(api, 'gitStatus').mockResolvedValue({
      available: true,
      repo: true,
      branch: 'main',
      truncated: false,
      files: ['src/a.ts', 'src/b.ts', 'src/c.ts'].map((path) => ({
        path,
        code: 'M',
        staged: false,
        unstaged: true,
      })),
    })
    await mount(
      <ProjectSourceContext.Provider value={{ path: '/project', name: 'Project' }}>
        <ChangesPane workspace tick={0} requestNonce={0} initialPath={null} fallbackLabel="" />
      </ProjectSourceContext.Provider>,
    )
    await click(container.querySelector('.source-tree-name[title="src/b.ts"]'))
    expect(
      [...container.querySelectorAll('.test-diff')].map((item) => item.getAttribute('data-path')),
    ).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts'])
  })
  it('collapses files independently and expands a collapsed navigation target', async () => {
    vi.spyOn(api, 'gitStatus').mockResolvedValue({
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
    })
    await mount(
      <ProjectSourceContext.Provider value={{ path: '/project', name: 'Project' }}>
        <ChangesPane workspace tick={0} requestNonce={0} initialPath={null} fallbackLabel="" />
      </ProjectSourceContext.Provider>,
    )
    const section = (path: string) => container.querySelector(`[data-diff-path="${path}"]`)!
    const toggle = (path: string) =>
      section(path).querySelector<HTMLButtonElement>('.git-file-trigger')!
    await click(toggle('src/b.ts'))
    expect(toggle('src/b.ts').getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(toggle('src/b.ts').getAttribute('aria-controls')!)?.hidden).toBe(
      true,
    )
    expect(toggle('src/a.ts').getAttribute('aria-expanded')).toBe('true')
    await click(container.querySelector('.source-tree-name[title="src/b.ts"]'))
    expect(toggle('src/b.ts').getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(toggle('src/b.ts').getAttribute('aria-controls')!)?.hidden).toBe(
      false,
    )
    expect(container.querySelectorAll('.git-diff-layout-toggle')).toHaveLength(1)
    expect(section('src/b.ts').querySelector('.git-file-action-bar')?.textContent).not.toContain(
      'Open file',
    )
  })
  it('keeps a failed discard attached to its file while other files remain readable', async () => {
    vi.spyOn(api, 'gitStatus').mockResolvedValue({
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
    })
    const restore = vi.spyOn(api, 'gitRestoreFile').mockRejectedValue(new Error('Repository busy'))
    await mount(
      <ProjectSourceContext.Provider value={{ path: '/project', name: 'Project' }}>
        <ChangesPane workspace tick={0} requestNonce={0} initialPath={null} fallbackLabel="" />
      </ProjectSourceContext.Provider>,
    )
    const second = () => container.querySelector('[data-diff-path="src/b.ts"]')!
    await click(second().querySelector('button[aria-label="Discard changes"]'))
    await click(second().querySelector('.source-restore button'))
    expect(restore).toHaveBeenCalledWith('/project', 'src/b.ts')
    expect(second().querySelector('[role="alert"]')?.textContent).toBe('Repository busy')
    expect(second().querySelector('.source-restore')).not.toBeNull()
    expect(container.querySelector('[data-diff-path="src/a.ts"] .test-diff')).not.toBeNull()
  })
  it('reveals search from its icon and clears it on Escape with focus returned', async () => {
    await mount(
      <GitFileNavigator
        compactSearch
        files={[
          { path: 'alpha.ts', code: 'M' },
          { path: 'beta.ts', code: 'M' },
        ]}
        selected={null}
        onSelect={() => {}}
      />,
    )
    expect(container.querySelector('input')).toBeNull()
    await click(container.querySelector('button[aria-expanded="false"]'))
    const input = container.querySelector<HTMLInputElement>('input')!
    expect(container.querySelector('.git-file-filters')!.nextElementSibling).toBe(
      container.querySelector('.git-file-search-reveal'),
    )
    await fill(input, 'alpha')
    expect(container.querySelectorAll('.git-file-option')).toHaveLength(1)
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    )
    expect(container.querySelector('button[aria-expanded="false"]')).not.toBeNull()
    expect(container.querySelector('.git-result-count')?.textContent).toBe('2 of 2 files')
    expect(document.activeElement).toBe(container.querySelector('button[aria-expanded="false"]'))
  })
  it('remembers the Changes file view across remounts without changing History defaults', async () => {
    const props = {
      files: [{ path: 'src/alpha.ts', code: 'M' }],
      selected: null,
      onSelect: () => {},
    }
    await mount(<GitFileNavigator {...props} persistView />)
    await click(container.querySelector('button[aria-label="List view"]'))
    expect(useWorkspace.getState().gitChangesView).toBe('list')
    await mount(<div />)
    await mount(<GitFileNavigator {...props} persistView />)
    expect(container.querySelector('.git-file-list')).not.toBeNull()
    await click(container.querySelector('button[aria-label="Tree view"]'))
    expect(useWorkspace.getState().gitChangesView).toBe('tree')
    await mount(<div />)
    await mount(<GitFileNavigator {...props} initialFlat />)
    expect(container.querySelector('.git-file-list')).not.toBeNull()
    await click(container.querySelector('button[aria-label="Tree view"]'))
    expect(useWorkspace.getState().gitChangesView).toBe('tree')
  })
  it('keeps the selected repository when opening a file outside the active chat project', async () => {
    vi.spyOn(api, 'gitStatus').mockResolvedValue({
      available: true,
      repo: true,
      branch: 'feature',
      truncated: false,
      files: [{ path: 'src/other.ts', code: 'M', staged: false, unstaged: true }],
    })
    function RequestProbe() {
      const source = useSource()!
      return (
        <output
          className="request-probe"
          data-project={source.request.projectPath}
          data-path={source.request.path}
        />
      )
    }
    await mount(
      <SourceProvider>
        <RequestProbe />
        <ProjectSourceContext.Provider value={{ path: '/other-repository', name: 'Other' }}>
          <ChangesPane workspace tick={0} requestNonce={0} initialPath={null} fallbackLabel="" />
        </ProjectSourceContext.Provider>
      </SourceProvider>,
    )
    await click(container.querySelector('button[aria-label="Open file"]'))
    expect(container.querySelector<HTMLElement>('.request-probe')?.dataset.project).toBe(
      '/other-repository',
    )
    expect(container.querySelector<HTMLElement>('.request-probe')?.dataset.path).toBe(
      'src/other.ts',
    )
    expect(navigateToPage).toHaveBeenLastCalledWith('chat')
  })
  it('shows a repository read error rather than stale commit details', async () => {
    vi.mocked(api.gitLogPage).mockRejectedValueOnce(new Error('Repository unavailable'))
    await mount(history())
    expect(container.textContent).toContain('Repository unavailable')
    expect(container.querySelector('.test-diff')).toBeNull()
  })
  it('links branch filtering, the selected commit, its files and its diff', async () => {
    await mount(history())
    expect(container.querySelector('.test-diff')?.getAttribute('data-path')).toBe('src/a.ts')
    await click(button('feature'))
    expect(api.gitLogPage).toHaveBeenLastCalledWith('/project', null, 'bbbb2222')
    expect(container.querySelector('.test-diff')?.getAttribute('data-revision')).toBe('bbbb2222')
    expect(container.querySelector('.test-diff')?.getAttribute('data-path')).toBe('src/b.ts')
    expect(container.querySelector('.git-commit-details')?.textContent).toContain('Second change')
  })
  it('loads the next page and selects a commit without losing previous rows', async () => {
    await mount(history())
    await click(button('Load more'))
    expect(api.gitLogPage).toHaveBeenLastCalledWith('/project', null, null, 1)
    expect(container.querySelectorAll('.git-log-row')).toHaveLength(2)
    await click(
      [...container.querySelectorAll('.git-log-row')].find((el) =>
        el.textContent?.includes('Second change'),
      ),
    )
    expect(container.querySelector('.test-diff')?.getAttribute('data-path')).toBe('src/b.ts')
    expect(button('Load more')).toBeUndefined()
  })
  it('passes a file-history scope through the log API and can clear it', async () => {
    await mount(history('src/a.ts'))
    expect(api.gitLogPage).toHaveBeenLastCalledWith('/project', 'src/a.ts', null)
    await click(container.querySelector('.git-path-filter button'))
    expect(api.gitLogPage).toHaveBeenLastCalledWith('/project', null, null)
  })
  it('includes untracked files in the added status filter', async () => {
    await mount(
      <GitFileNavigator
        files={[
          { path: 'new.ts', code: '?' },
          { path: 'modified.ts', code: 'M' },
        ]}
        selected={null}
        onSelect={() => {}}
      />,
    )
    await click(button('A'))
    expect(container.querySelector('.source-tree')?.textContent).toContain('new.ts')
    expect(container.querySelector('.source-tree')?.textContent).not.toContain('modified.ts')
  })
  it('searches file names and complete paths beyond the visible result window', async () => {
    const files = Array.from({ length: 1500 }, (_, index) => ({
      path: `packages/module-${index}/settings.ts`,
      code: 'M',
    }))
    files.push({ path: 'src/preferences/UniquePreferences.tsx', code: 'M' })
    function Probe() {
      const result = useFileSearch(files, 'UniquePreferences')
      return <div>{result[0]?.path}</div>
    }
    await mount(<Probe />)
    expect(container.textContent).toBe('src/preferences/UniquePreferences.tsx')
  })
  it('distinguishes quick-find matches from the complete file scope as the query changes', async () => {
    await mount(
      <GitQuickFind
        files={[
          { path: 'src/alpha.ts', code: 'M' },
          { path: 'src/beta.ts', code: 'M' },
        ]}
        selected={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        scope="Commit aaaa1111"
      />,
    )
    const status = () => document.querySelector('.git-quick-scope [role="status"]')?.textContent
    const input = document.querySelector<HTMLInputElement>('.git-quick-input input')!
    expect(status()).toBe('Matches: 2 of 2 files')
    await fill(input, 'alpha')
    expect(status()).toBe('Matches: 1 of 2 files')
    expect(document.querySelectorAll('.git-quick-row')).toHaveLength(1)
    await fill(input, 'nothing-matches-here')
    expect(status()).toBe('Matches: 0 of 2 files')
    expect(document.querySelectorAll('.git-quick-row')).toHaveLength(0)
    expect(document.querySelector('.git-quick-scope')?.textContent).toContain('Commit aaaa1111')
  })
  it('searches loaded commit hashes without stale file details', async () => {
    await mount(history())
    await click(button('Load more'))
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Filter commits"]')!
    await fill(input, 'bbbb2222')
    expect(container.querySelectorAll('.git-log-row')).toHaveLength(1)
    expect(container.querySelector('.test-diff')?.getAttribute('data-revision')).toBe('bbbb2222')
  })
})

describe('Git branch confirmations', () => {
  const feature = { name: 'feature', tip: 'bbbb2222', remote: false, current: false }
  const clean = { current: 'main', head: 'aaaa1111', operation: null, dirty: false } as const
  async function actionMenu(label: string) {
    await click(container.querySelector('button[aria-label="Actions for feature"]'))
    await click(
      [...document.querySelectorAll('[role="menuitem"]')].find((item) =>
        item.textContent?.includes(label),
      ),
    )
  }
  function dialogButton(label: string) {
    return [...document.querySelectorAll('[role="dialog"] button')].find(
      (item) => item.textContent === label,
    )
  }
  it('confirms the exact merge direction before calling the native operation', async () => {
    vi.spyOn(api, 'gitBranchState').mockResolvedValue(clean)
    const mutation = vi.spyOn(api, 'gitBranchAction').mockResolvedValue()
    const changed = vi.fn()
    await mount(
      <GitBranchActions projectPath="/project" branch={feature} tick={0} onChanged={changed} />,
    )
    await actionMenu('Merge into current')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'Merge feature into the current branch main.',
    )
    expect(mutation).not.toHaveBeenCalled()
    await click(dialogButton('Merge'))
    expect(mutation).toHaveBeenCalledWith('/project', {
      action: 'merge',
      target: 'refs/heads/feature',
      targetTip: 'bbbb2222',
      expectedHead: 'aaaa1111',
      expectedBranch: 'main',
      name: '',
    })
    expect(changed).toHaveBeenCalledOnce()
  })
  it('blocks merge while dirty, but lets Git preserve working changes on a new branch', async () => {
    vi.spyOn(api, 'gitBranchState').mockResolvedValue({ ...clean, dirty: true })
    const mutation = vi
      .spyOn(api, 'gitBranchAction')
      .mockRejectedValueOnce(new Error('Would overwrite local changes'))
    await mount(
      <GitBranchActions projectPath="/project" branch={feature} tick={0} onChanged={vi.fn()} />,
    )
    await actionMenu('Merge into current')
    expect((dialogButton('Merge') as HTMLButtonElement).disabled).toBe(true)
    expect(mutation).not.toHaveBeenCalled()
    await click(dialogButton('Cancel'))
    await actionMenu('New branch & switch')
    const name = document.querySelector<HTMLInputElement>('.git-branch-dialog input')!
    await fill(name, 'work/keep-this-name')
    expect((dialogButton('Create & switch') as HTMLButtonElement).disabled).toBe(false)
    await click(dialogButton('Create & switch'))
    expect(name.value).toBe('work/keep-this-name')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'Would overwrite local changes',
    )
    expect(mutation).toHaveBeenCalledOnce()
  })
  it('shows conflicts and requires a separate abort confirmation', async () => {
    vi.spyOn(api, 'gitBranchState')
      .mockResolvedValueOnce(clean)
      .mockResolvedValue({ ...clean, operation: 'merge', dirty: true })
    const mutation = vi
      .spyOn(api, 'gitBranchAction')
      .mockRejectedValueOnce(new Error('CONFLICT in file.ts'))
      .mockResolvedValue()
    await mount(
      <GitBranchActions projectPath="/project" branch={feature} tick={0} onChanged={vi.fn()} />,
    )
    await actionMenu('Merge into current')
    await click(dialogButton('Merge'))
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('CONFLICT in file.ts')
    expect((dialogButton('Merge') as HTMLButtonElement).disabled).toBe(true)
    await click(dialogButton('Abort merge'))
    expect(mutation).toHaveBeenCalledTimes(1)
    await click(dialogButton('Abort merge'))
    expect(mutation).toHaveBeenLastCalledWith(
      '/project',
      expect.objectContaining({ action: 'abortMerge' }),
    )
  })
  it('collapses remote branches and reveals matching branches while searching', async () => {
    vi.mocked(api.gitBranches).mockResolvedValue([
      { ...feature, name: 'origin/feature', remote: true },
    ])
    await mount(history())
    await click(
      [...container.querySelectorAll('button')].find((item) =>
        item.textContent?.startsWith('Remote'),
      ),
    )
    expect(button('origin/feature')).toBeUndefined()
    await click(container.querySelector('button[aria-label="Find branch…"]'))
    await fill(
      container.querySelector<HTMLInputElement>('input[aria-label="Find branch…"]')!,
      'feature',
    )
    expect(button('origin/feature')).toBeTruthy()
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Find branch…"]')!
    await click(
      [...container.querySelectorAll('button')].find((item) =>
        item.textContent?.startsWith('Remote'),
      ),
    )
    expect(button('origin/feature')).toBeUndefined()
    await fill(input, 'origin')
    expect(button('origin/feature')).toBeTruthy()
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    )
    expect(button('origin/feature')).toBeUndefined()
    expect(document.activeElement).toBe(
      container.querySelector('button[aria-label="Find branch…"]'),
    )
  })
})
