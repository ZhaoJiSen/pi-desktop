// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitSettings } from '../../src/pages/settings/GitSettings'
import { useGitFetchInterval } from '../../src/hooks/useGitFetchInterval'
import { readFetchInterval } from '../../src/lib/source/sync'
import { useWorkspace } from '../../src/store/workspace'
let root: Root, container: HTMLDivElement
const initial = useWorkspace.getState()
function LivePreference() {
  const value = useGitFetchInterval('/git-settings/a')
  return <output data-live>{value}</output>
}
async function mount() {
  await act(async () =>
    root.render(
      <>
        <GitSettings />
        <LivePreference />
      </>,
    ),
  )
}
async function open(index: number) {
  const button = container.querySelectorAll<HTMLButtonElement>('.settings-git-select button')[index]
  expect(button).toBeTruthy()
  await act(async () => button!.click())
}
async function choose(text: string) {
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((el) =>
    el.textContent?.startsWith(text),
  )
  expect(option).toBeTruthy()
  await act(async () => option!.click())
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useWorkspace.setState({
    language: 'en',
    activeSessionId: null,
    projects: [
      {
        id: 'repo-a',
        name: 'Repository A',
        path: '/git-settings/a',
        branch: 'main',
        collapsed: false,
      },
      {
        id: 'repo-b',
        name: 'Repository B',
        path: '/git-settings/b',
        branch: 'dev',
        collapsed: false,
      },
    ],
  })
  for (const path of ['a', 'b'])
    localStorage.removeItem(`pi.git-auto-fetch.v1:/git-settings/${path}`)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const path of ['a', 'b'])
    localStorage.removeItem(`pi.git-auto-fetch.v1:/git-settings/${path}`)
  useWorkspace.setState({ projects: initial.projects, activeSessionId: initial.activeSessionId })
})
describe('Git settings', () => {
  it('saves per-repository preferences, updates live readers and reads back after remount', async () => {
    await mount()
    await open(1)
    await choose('Every 5 min')
    expect(readFetchInterval('/git-settings/a')).toBe(5)
    expect(container.querySelector('[data-live]')?.textContent).toBe('5')
    expect(container.textContent).toContain('Auto fetch preference saved')
    await act(async () => root.render(null))
    await mount()
    expect(container.querySelectorAll('.settings-git-select')[1]?.textContent).toContain(
      'Every 5 min',
    )
  })
  it('keeps each repository independent when changing the selection', async () => {
    await mount()
    await open(1)
    await choose('Every 5 min')
    await open(0)
    await choose('Repository B')
    await open(1)
    await choose('Every 1 min')
    expect(readFetchInterval('/git-settings/b')).toBe(1)
    expect(container.querySelector('[data-live]')?.textContent).toBe('5')
    await open(0)
    await choose('Repository A')
    expect(container.querySelectorAll('.settings-git-select')[1]?.textContent).toContain(
      'Every 5 min',
    )
  })
  it('retains the saved value after storage failure and allows retry', async () => {
    await mount()
    await open(1)
    const write = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('Storage full')
    })
    await choose('Every 5 min')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not save')
    expect(readFetchInterval('/git-settings/a')).toBe(0)
    expect(container.querySelectorAll('.settings-git-select')[1]?.textContent).toContain(
      'Auto fetch off',
    )
    write.mockRestore()
    await open(1)
    await choose('Every 1 min')
    expect(readFetchInterval('/git-settings/a')).toBe(1)
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
  it('reacts to storage updates from another window without remounting', async () => {
    await mount()
    await act(async () => {
      localStorage.setItem('pi.git-auto-fetch.v1:/git-settings/a', '10')
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'pi.git-auto-fetch.v1:/git-settings/a' }),
      )
    })
    expect(container.querySelector('[data-live]')?.textContent).toBe('10')
    expect(container.querySelectorAll('.settings-git-select')[1]?.textContent).toContain(
      'Every 10 min',
    )
  })
})
