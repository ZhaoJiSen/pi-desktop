// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesktopUpdateStatus } from '../../src/hooks/useDesktopUpdate'

vi.mock('../../src/store/workspace', async (original) => ({
  ...(await original<typeof import('../../src/store/workspace')>()),
  isDesktop: true,
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { DesktopUpdateButton } from '../../src/components/DesktopUpdateButton'
import { useWorkspace } from '../../src/store/workspace'

const available: DesktopUpdateStatus = {
  revision: 1,
  phase: 'available',
  version: '0.2.0',
  currentVersion: '0.1.0',
  notes: 'Improved desktop updates.',
  downloaded: 0,
  total: null,
  error: null,
}
let root: Root, container: HTMLDivElement
let receive: (event: { payload: DesktopUpdateStatus }) => void
const unlisten = vi.fn()

async function render() {
  await act(async () => root.render(createElement(DesktopUpdateButton)))
}
async function emit(patch: Partial<DesktopUpdateStatus>) {
  await act(async () => receive({ payload: { ...available, ...patch } }))
}
async function click(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (item) => item.getAttribute('aria-label') === label || item.textContent === label,
  )
  expect(button, label).toBeDefined()
  await act(async () => button!.click())
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(invoke).mockReset().mockResolvedValue(available)
  vi.mocked(listen)
    .mockReset()
    .mockImplementation(async (_event, handler) => {
      receive = handler as typeof receive
      return unlisten
    })
  unlisten.mockReset()
  useWorkspace.setState({
    language: 'en',
    runningSessionId: null,
    piBusyRuns: [],
    piUpdating: false,
    connection: 'disconnected',
    storageError: null,
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('desktop update entry', () => {
  it.each(['checking', 'idle'] as const)('stays hidden while %s', async (phase) => {
    vi.mocked(invoke).mockResolvedValue({ ...available, phase, version: null })
    await render()
    expect(document.querySelector('button')).toBeNull()
  })

  it('shows only an icon until opened, then downloads on explicit user action', async () => {
    await render()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(invoke).toHaveBeenCalledExactlyOnceWith('desktop_update_status')
    await click('Update pi Desktop to 0.2.0')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('0.1.0')
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('keep working')
    await click('Download update')
    expect(invoke).toHaveBeenCalledWith('download_desktop_update')
    await emit({ revision: 2, phase: 'downloading', downloaded: 25, total: 100 })
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25')
    expect(document.querySelector('button.desktop-update-primary')).toBeNull()
    await click('Hide')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25')
    expect(invoke).toHaveBeenCalledTimes(2)
    await emit({ revision: 3, phase: 'ready' })
    expect(document.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('renders the latest release notes as a readable list', async () => {
    vi.mocked(invoke).mockResolvedValue({
      ...available,
      notes: '### Changes\n- Restore sessions\n- Improve downloads',
    })
    await render()
    await click('Update pi Desktop to 0.2.0')
    await act(async () => {
      await vi.dynamicImportSettled()
    })
    const notes = document.querySelector('[role="region"][aria-label="What’s new"]')
    expect(notes?.querySelectorAll('li')).toHaveLength(2)
    expect(notes?.textContent).toContain('Restore sessions')
    expect(notes?.textContent).not.toContain('###')
  })

  it('shows byte counts and supports an unknown download size without a fake percentage', async () => {
    await render()
    await click('Update pi Desktop to 0.2.0')
    await emit({ revision: 2, phase: 'downloading', downloaded: 12_500_000, total: null })
    expect(document.querySelector('[role="progressbar"]')?.hasAttribute('aria-valuenow')).toBe(
      false,
    )
    expect(document.querySelector('.desktop-update-transfer')?.getAttribute('title')).toBe(
      '12.5 MB',
    )
    expect(document.querySelector('.desktop-update-transfer')?.textContent).not.toContain('%')
    await emit({ revision: 3, phase: 'downloading', downloaded: 12_500_000, total: 25_000_000 })
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('50')
    expect(document.querySelector('.desktop-update-transfer')?.getAttribute('title')).toBe(
      '12.5 MB / 25 MB',
    )
    await emit({ revision: 4, phase: 'downloading', downloaded: 25_000_000, total: 25_000_000 })
    expect(document.querySelector('.desktop-update-transfer')?.textContent).toBe('Verifying…')
    expect(document.querySelector('[role="progressbar"]')?.hasAttribute('aria-valuenow')).toBe(
      false,
    )
  })

  it('keeps newer events when the initial status response arrives late', async () => {
    let resolve!: (status: DesktopUpdateStatus) => void
    vi.mocked(invoke).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    await render()
    await emit({ revision: 4, phase: 'ready' })
    await act(async () => resolve(available))
    expect(document.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Restart to update pi Desktop to 0.2.0',
    )
  })

  it('allows retry after a download failure', async () => {
    await render()
    await click('Update pi Desktop to 0.2.0')
    await emit({ revision: 3, error: 'Network unavailable' })
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Network unavailable')
    await click('Retry download')
    expect(invoke).toHaveBeenCalledWith('download_desktop_update')
  })

  it('prevents restarting busy sessions and keeps the downloaded update available', async () => {
    await render()
    await emit({ revision: 4, phase: 'ready' })
    await act(async () => useWorkspace.setState({ piBusyRuns: ['background-project'] }))
    await click('Restart to update pi Desktop to 0.2.0')
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Ready to update',
    )
    expect(document.querySelector('button.desktop-update-primary')?.hasAttribute('disabled')).toBe(
      true,
    )
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'Wait for running Pi tasks',
    )
    expect(invoke).not.toHaveBeenCalledWith('install_desktop_update')
    await act(async () => useWorkspace.setState({ piBusyRuns: [] }))
    await click('Restart and update')
    expect(invoke).toHaveBeenCalledWith('install_desktop_update')
    await emit({ revision: 5, phase: 'installing' })
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Restarting…',
    )
    expect(document.querySelector('.desktop-update-trigger')?.getAttribute('aria-label')).toBe(
      'Restarting…',
    )
    expect(document.querySelector('button.desktop-update-primary')?.hasAttribute('disabled')).toBe(
      true,
    )
    await click('Hide')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await click('Restarting…')
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Restarting…',
    )
  })

  it('does not restart when workspace persistence has failed', async () => {
    await render()
    await emit({ revision: 4, phase: 'ready' })
    await click('Restart to update pi Desktop to 0.2.0')
    const save = vi
      .spyOn(useWorkspace, 'savePersistence')
      .mockRejectedValueOnce(new Error('Disk full'))
    await click('Restart and update')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not save your workspace',
    )
    expect(invoke).not.toHaveBeenCalledWith('install_desktop_update')
    await click('Restart and update')
    expect(save).toHaveBeenCalledTimes(2)
    expect(invoke).toHaveBeenCalledWith('install_desktop_update')
  })

  it('keeps the downloaded update available when a native package operation blocks installation', async () => {
    await render()
    await emit({ revision: 4, phase: 'ready' })
    await click('Restart to update pi Desktop to 0.2.0')
    await click('Restart and update')
    await emit({ revision: 5, phase: 'ready', error: 'Another package operation is in progress' })
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('package operation')
    expect(document.querySelector('.desktop-update-primary')?.textContent).toBe(
      'Restart and update',
    )
    await click('Restart and update')
    expect(
      vi.mocked(invoke).mock.calls.filter(([command]) => command === 'install_desktop_update'),
    ).toHaveLength(2)
    expect(invoke).not.toHaveBeenCalledWith('download_desktop_update')
  })

  it('unsubscribes when the component is removed', async () => {
    await render()
    await act(async () => root.render(null))
    expect(unlisten).toHaveBeenCalledOnce()
  })
})
