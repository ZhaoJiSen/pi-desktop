// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitRemoteSync } from '../../../src/components/source/GitRemoteSync'
import { onActionNotice } from '../../../src/lib/notices'
import * as api from '../../../src/lib/source/api'
import { readFetchInterval, saveFetchInterval } from '../../../src/lib/source/sync'
import type { GitSyncState } from '../../../src/lib/source/types'
import { useWorkspace } from '../../../src/store/workspace'
let root: Root, container: HTMLDivElement, state: GitSyncState
let changed: ReturnType<typeof vi.fn<() => void>>, fetched: ReturnType<typeof vi.fn<() => void>>
async function render() {
  await act(async () =>
    root.render(
      <GitRemoteSync
        projectPath="/sync-test"
        tick={0}
        onChanged={changed}
        onFetched={fetched}
        onShowChanges={vi.fn()}
      >
        <span>Repo / main</span>
      </GitRemoteSync>,
    ),
  )
}
async function click(text: string) {
  const button = [...document.querySelectorAll('button')]
    .filter((el) => el.textContent === text)
    .at(-1)
  expect(button).toBeTruthy()
  await act(async () => button!.click())
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
  localStorage.removeItem('pi.git-auto-fetch.v1:/sync-test')
  state = {
    branch: { current: 'main', head: 'abcd1234', dirty: false, operation: null },
    remote: 'origin',
    upstream: 'origin/main',
    ahead: 1,
    behind: 2,
    lastFetch: null,
    conflicts: [],
  }
  vi.spyOn(api, 'gitSyncState').mockImplementation(async () => structuredClone(state))
  vi.spyOn(api, 'gitSyncAction').mockResolvedValue()
  changed = vi.fn()
  fetched = vi.fn()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.removeItem('pi.git-auto-fetch.v1:/sync-test')
})
describe('remote synchronization', () => {
  it.each(['fetch', 'pull'] as const)(
    'shows %s progress until the request settles and blocks duplicate actions',
    async (action) => {
      let complete!: () => void
      vi.mocked(api.gitSyncAction).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve
          }),
      )
      await render()
      if (action === 'pull') await click('Pull')
      await click(action === 'fetch' ? 'Fetch' : 'Pull')
      const label = action === 'fetch' ? 'Fetching…' : 'Pulling…'
      const pendingButtons = [...document.querySelectorAll('button')].filter(
        (button) => button.textContent === label,
      )
      expect(pendingButtons).toHaveLength(action === 'pull' ? 2 : 1)
      for (const button of pendingButtons) {
        expect(button.getAttribute('data-pending')).toBe('true')
        expect(button.querySelector('.spinner')).not.toBeNull()
        await act(async () => button.click())
      }
      expect(
        [...container.querySelectorAll('.git-sync-button')].every(
          (button) => (button as HTMLButtonElement).disabled,
        ),
      ).toBe(true)
      expect(api.gitSyncAction).toHaveBeenCalledTimes(1)
      await act(async () => complete())
      expect(document.body.textContent).not.toContain(label)
      expect(container.querySelector('.git-sync-button .spinner')).toBeNull()
      expect(
        [...container.querySelectorAll('.git-sync-button')].every(
          (button) => !(button as HTMLButtonElement).disabled,
        ),
      ).toBe(true)
    },
  )

  it('reports Fetch and Pull success as success notices without a page banner', async () => {
    const notices: { message: string; tone: string }[] = []
    const stop = onActionNotice((message, tone) => notices.push({ message, tone }))
    try {
      await render()
      await click('Fetch')
      expect(notices).toEqual([{ message: 'Fetch completed', tone: 'success' }])
      expect(container.querySelector('.git-sync-banner')).toBeNull()
      await click('Pull')
      await click('Pull')
      expect(notices.at(-1)).toEqual({ message: 'Pull completed', tone: 'success' })
      expect(container.querySelector('.git-sync-banner')).toBeNull()
    } finally {
      stop()
    }
  })
  it('keeps failures persistent and does not report them as successful toasts', async () => {
    const notices: string[] = []
    const stop = onActionNotice((message) => notices.push(message))
    vi.mocked(api.gitSyncAction).mockRejectedValueOnce(new Error('Permission denied'))
    try {
      await render()
      await click('Fetch')
      expect(notices).toEqual([])
      expect(container.querySelector('.git-sync-banner')?.textContent).toContain(
        'Permission denied',
      )
    } finally {
      stop()
    }
  })

  it('moves toolbar focus between actions without entering passive tooltip wrappers', async () => {
    await render()
    const fetch = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Fetch',
    )!
    const pull = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Pull',
    )!
    await act(async () => {
      fetch.focus()
      fetch.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(document.activeElement).toBe(pull)
    await act(async () =>
      pull.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })),
    )
    expect(document.activeElement).toBe(fetch)
    expect(api.gitSyncAction).not.toHaveBeenCalled()
  })

  it('updates the active fetch timer when Settings changes its preference', async () => {
    const interval = vi.spyOn(window, 'setInterval')
    const clear = vi.spyOn(window, 'clearInterval')
    await render()
    expect(interval.mock.calls.some((call) => call[1] === 60000)).toBe(false)
    await act(async () => saveFetchInterval('/sync-test', 1))
    expect(interval.mock.calls.some((call) => call[1] === 60000)).toBe(true)
    await act(async () => saveFetchInterval('/sync-test', 0))
    expect(clear).toHaveBeenCalledOnce()
  })

  it('fetches without resetting the repository views and confirms Pull with the displayed snapshot', async () => {
    vi.mocked(api.gitSyncAction).mockImplementation(async (_, request) => {
      if (request.action === 'pull') state.branch.head = 'new-head'
    })
    await render()
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Fetch settings"]')).toBeNull()
    await click('Fetch')
    expect(api.gitSyncAction).toHaveBeenLastCalledWith(
      '/sync-test',
      expect.objectContaining({ action: 'fetch', expectedHead: 'abcd1234' }),
    )
    expect(fetched).toHaveBeenCalledOnce()
    expect(changed).not.toHaveBeenCalled()
    await click('Pull')
    expect(document.body.textContent).toContain('Update main from origin/main')
    expect(api.gitSyncAction).toHaveBeenCalledTimes(1)
    await click('Pull')
    expect(api.gitSyncAction).toHaveBeenLastCalledWith(
      '/sync-test',
      expect.objectContaining({
        action: 'pull',
        mode: 'ffOnly',
        expectedBranch: 'main',
        expectedUpstream: 'origin/main',
      }),
    )
    expect(changed).toHaveBeenCalledOnce()
  })
  it('preserves Pull policy and its error after failure, allowing retry', async () => {
    vi.mocked(api.gitSyncAction).mockRejectedValueOnce(new Error('SOURCE_SYNC_CHANGED'))
    await render()
    await click('Pull')
    const radio = document.querySelector<HTMLInputElement>('input[value="rebase"]')!
    await act(async () => radio.click())
    await click('Pull')
    expect(document.body.textContent).toContain('The repository or file changed')
    expect(changed).not.toHaveBeenCalled()
    expect(document.querySelector<HTMLInputElement>('input[value="rebase"]')?.checked).toBe(true)
    await click('Pull')
    expect(api.gitSyncAction).toHaveBeenLastCalledWith(
      '/sync-test',
      expect.objectContaining({ mode: 'rebase' }),
    )
  })
  it('blocks dirty and untracked branches with a visible explanation', async () => {
    state.branch.dirty = true
    await render()
    await click('Pull')
    expect(document.body.textContent).toContain('Commit or stash local changes')
    const confirm = [...document.querySelectorAll('button')].find(
      (el) => el.textContent === 'Pull' && el.closest('[role="dialog"]'),
    )
    expect(confirm?.disabled).toBe(true)
    expect(api.gitSyncAction).not.toHaveBeenCalled()
  })
  it('reads the persisted fetch interval, runs only Fetch, and removes timers on unmount', async () => {
    saveFetchInterval('/sync-test', 1)
    expect(readFetchInterval('/sync-test')).toBe(1)
    const interval = vi.spyOn(window, 'setInterval')
    const clear = vi.spyOn(window, 'clearInterval')
    await render()
    const timer = interval.mock.calls.find((call) => call[1] === 60000)
    expect(timer).toBeTruthy()
    await act(async () => {
      ;(timer![0] as () => void)()
    })
    expect(api.gitSyncAction).toHaveBeenCalledOnce()
    expect(api.gitSyncAction).toHaveBeenCalledWith(
      '/sync-test',
      expect.objectContaining({ action: 'fetch' }),
    )
    await act(async () => root.render(null))
    expect(clear).toHaveBeenCalledTimes(2)
    await render()
    expect(readFetchInterval('/sync-test')).toBe(1)
  })
  it('keeps conflicts visible after reopening, requires explicit staging, then allows Continue', async () => {
    state.branch.operation = 'merge'
    state.branch.dirty = true
    state.conflicts = ['src/a.ts']
    vi.mocked(api.gitSyncAction).mockImplementation(async (_, request) => {
      if (request.action === 'resolve') state.conflicts = []
    })
    await render()
    expect(container.textContent).toContain('Merge in progress')
    await click('Resolve conflicts')
    const continueButton = [...document.querySelectorAll('button')].find(
      (el) => el.textContent === 'Continue Merge',
    )
    expect(continueButton?.disabled).toBe(true)
    await click('Mark resolved')
    expect(api.gitSyncAction).not.toHaveBeenCalled()
    await click('Mark resolved')
    expect(api.gitSyncAction).toHaveBeenLastCalledWith(
      '/sync-test',
      expect.objectContaining({ action: 'resolve', relative: 'src/a.ts' }),
    )
    await click('Continue Merge')
    expect(api.gitSyncAction).toHaveBeenLastCalledWith(
      '/sync-test',
      expect.objectContaining({ action: 'continue' }),
    )
  })
  it('retains the edited text after save failure and stages nothing implicitly', async () => {
    state.branch.operation = 'rebase'
    state.conflicts = ['src/a.ts']
    vi.spyOn(api, 'readProjectFile').mockResolvedValue({
      path: 'src/a.ts',
      size: 10,
      text: 'conflicted',
      binary: false,
      truncated: false,
    })
    vi.spyOn(api, 'gitConflictWrite').mockRejectedValue(new Error('SOURCE_SYNC_CHANGED'))
    await render()
    await click('Resolve conflicts')
    await click('Edit resolution')
    const textarea = document.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        textarea,
        'resolved',
      )
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('Save resolution')
    expect(textarea.value).toBe('resolved')
    expect(document.body.textContent).toContain('The repository or file changed')
    expect(api.gitConflictWrite).toHaveBeenCalledWith(
      '/sync-test',
      'src/a.ts',
      'conflicted',
      'resolved',
    )
    expect(api.gitSyncAction).not.toHaveBeenCalled()
  })
})
