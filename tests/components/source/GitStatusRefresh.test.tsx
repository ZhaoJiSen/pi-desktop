// @vitest-environment happy-dom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  GitRepositoryStatusProvider,
  useGitRepositoryStatus,
} from '../../../src/components/source/GitRepositoryStatus'
import * as api from '../../../src/lib/source/api'
import type { GitStatus } from '../../../src/lib/source/types'
import { ChangesPane } from '../../../src/components/source/ChangesView'
import { ProjectSourceContext } from '../../../src/components/source/useProjectSource'
import { useWorkspace } from '../../../src/store/workspace'
import { useGitRemoteSync } from '../../../src/components/source/useGitRemoteSync'

const project = vi.hoisted(() => ({
  path: '/project',
  name: 'Project',
  revision: 1,
  agent: new Set<string>(),
}))
vi.mock('../../../src/components/source/useProjectSource', async (original) => ({
  ...(await original<typeof import('../../../src/components/source/useProjectSource')>()),
  useProjectSource: () => project,
}))

vi.mock('../../../src/router/navigation', () => ({ navigateToPage: vi.fn() }))
vi.mock('../../../src/components/source/FileDiff', () => ({
  FileDiff: ({ text }: { text: string }) => <div className="loaded-patch">{text}</div>,
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRef } = await import('react')
  return {
    useVirtualizer: (options: { count: number }) => {
      const latest = useRef(options)
      latest.current = options
      const value = useRef({
        getVirtualItems: () =>
          Array.from({ length: latest.current.count }, (_, index) => ({
            index,
            start: index * 200,
            size: 200,
          })),
        getTotalSize: () => latest.current.count * 200,
        scrollToIndex: vi.fn(),
        measureElement: vi.fn(),
        getVirtualItemForOffset: () => ({ index: 0 }),
        scrollOffset: 0,
      })
      return value.current
    },
  }
})

let root: Root, container: HTMLDivElement, status: GitStatus
let current: ReturnType<typeof useGitRepositoryStatus>
function Probe() {
  const value = useGitRepositoryStatus()
  useEffect(() => {
    current = value
  }, [value])
  return <output>{value?.status.data?.files.length}</output>
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
  useWorkspace.setState({ language: 'en' })
  project.revision = 1
  status = { available: true, repo: true, branch: 'main', truncated: false, files: [] }
  vi.spyOn(api, 'gitStatus').mockImplementation(async () => structuredClone(status))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <GitRepositoryStatusProvider projectPath="/project" revision={0} tick={0}>
        <Probe />
      </GitRepositoryStatusProvider>,
    ),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('refreshes changed files immediately when returning from an external editor', async () => {
  status.files = [{ path: 'new.ts', code: 'M', staged: false, unstaged: true }]
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(container.textContent).toBe('1')
  expect(api.gitStatus).toHaveBeenCalledTimes(2)
  status.files = []
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(container.textContent).toBe('0')
})
it('invalidates patch contents on a visible poll without replacing an unchanged file list', async () => {
  const previous = current!.status.data
  const revision = current!.revision
  await act(async () => vi.advanceTimersByTime(15000))
  expect(api.gitStatus).toHaveBeenCalledTimes(2)
  expect(current!.status.data).toBe(previous)
  expect(current!.revision).toBeGreaterThan(revision)
})
it('skips background refresh and removes listeners on unmount', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(30000)
  })
  expect(api.gitStatus).toHaveBeenCalledTimes(1)
  await act(async () => root.render(null))
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    vi.advanceTimersByTime(30000)
  })
  expect(api.gitStatus).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

it('reloads an edited patch with unchanged status and clears a file reverted externally', async () => {
  status.files = [{ path: 'a.ts', code: 'M', staged: false, unstaged: true }]
  const diff = {
    available: true,
    repo: true,
    path: 'a.ts',
    binary: false,
    truncated: false,
    missing: false,
    text: 'first patch',
  }
  vi.spyOn(api, 'gitFileDiff').mockResolvedValue(diff)
  const view = () => (
    <ProjectSourceContext.Provider value={{ path: '/project', name: 'Project' }}>
      <GitRepositoryStatusProvider projectPath="/project" revision={project.revision} tick={0}>
        <ChangesPane workspace tick={0} requestNonce={0} initialPath={null} fallbackLabel="" />
      </GitRepositoryStatusProvider>
    </ProjectSourceContext.Provider>
  )
  await act(async () => root.render(view()))
  expect(container.querySelector('.loaded-patch')?.textContent).toBe('first patch')
  vi.mocked(api.gitFileDiff).mockResolvedValue({ ...diff, text: 'updated patch' })
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(container.querySelector('.loaded-patch')?.textContent).toBe('updated patch')
  // A lower Pi revision plus a newer refresh must not reuse an old numeric-sum cache key.
  project.revision = 0
  vi.mocked(api.gitFileDiff).mockResolvedValue({ ...diff, text: 'patch after switching sessions' })
  await act(async () => root.render(view()))
  expect(container.querySelector('.loaded-patch')?.textContent).toBe(
    'patch after switching sessions',
  )
  status.files = []
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(container.querySelector('.loaded-patch')).toBeNull()
  expect(container.querySelector('.git-changes-review')?.textContent).toContain(
    'Working tree is clean',
  )
})

it('explains repository changes outside a clean project-scoped file list', async () => {
  vi.spyOn(api, 'gitSyncState').mockResolvedValue({
    branch: { current: 'main', head: 'abcd1234', dirty: true, operation: null },
    remote: 'origin',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    lastFetch: null,
    conflicts: [],
  })
  function Reason() {
    const sync = useGitRemoteSync({
      projectPath: '/project',
      tick: 0,
      onChanged: () => {},
      onFetched: () => {},
    })
    return <output>{sync.pullBlockedReason}</output>
  }
  await act(async () =>
    root.render(
      <GitRepositoryStatusProvider projectPath="/project" revision={0} tick={0}>
        <Reason />
      </GitRepositoryStatusProvider>,
    ),
  )
  expect(container.textContent).toContain('outside the current file list')
})
