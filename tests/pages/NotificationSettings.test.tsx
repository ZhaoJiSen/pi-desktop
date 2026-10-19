// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('../../src/store/workspace', async (original) => ({
  ...(await original<typeof import('../../src/store/workspace')>()),
  isDesktop: true,
}))
import { NotificationSettings } from '../../src/pages/settings/NotificationSettings'
import { defaultNotificationPreferences } from '../../src/lib/notificationPreferences'
import { useNotificationStatus } from '../../src/lib/notifications'
import { createWorkspaceStore, useWorkspace } from '../../src/store/workspace'
let root: Root, container: HTMLDivElement
async function mount() {
  await act(async () => root.render(h(NotificationSettings)))
}
function toggle(index: number) {
  return container.querySelectorAll<HTMLInputElement>('.settings-inline-switch input')[index]!
}
async function clickText(text: string) {
  const button = [...container.querySelectorAll('button')].find((item) =>
    item.textContent?.includes(text),
  )!
  expect(button).toBeDefined()
  await act(async () => button.click())
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useWorkspace.setState({
    language: 'en',
    storageError: null,
    runningSessionId: null,
    notificationPreferences: { ...defaultNotificationPreferences },
  })
  useNotificationStatus.setState({ permission: 'unknown', error: '' })
  mocks.invoke.mockReset().mockResolvedValue('default')
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
describe('notification settings', () => {
  it('does not request authorization until enabling notifications and keeps denied settings off', async () => {
    await mount()
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('notification_permission', {
      request: false,
    })
    mocks.invoke.mockResolvedValue('denied')
    await act(async () => toggle(0).click())
    expect(toggle(0).checked).toBe(false)
    expect(container.textContent).toContain('Notifications are blocked')
    await clickText('Open system settings')
    expect(mocks.invoke).toHaveBeenLastCalledWith('open_notification_settings')
  })
  it('automatically saves after authorization and reads the same values back from storage', async () => {
    mocks.invoke.mockResolvedValue('granted')
    await mount()
    await act(async () => toggle(0).click())
    expect(useWorkspace.getState().notificationPreferences.system).toBe(true)
    await act(async () => toggle(3).click())
    const restored = createWorkspaceStore(localStorage, true)
    expect(restored.getState().notificationPreferences.system).toBe(true)
    expect(restored.getState().notificationPreferences.preview).toBe(true)
  })
  it('keeps failed edits across navigation and only applies them after a successful retry', async () => {
    await mount()
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('Disk full')
    })
    await act(async () => toggle(1).click())
    expect(toggle(1).checked).toBe(false)
    expect(useWorkspace.getState().notificationPreferences.attention).toBe(true)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not save notification settings',
    )
    await act(async () => root.render(null))
    await mount()
    expect(toggle(1).checked).toBe(false)
    await clickText('Retry')
    expect(useWorkspace.getState().notificationPreferences.attention).toBe(false)
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
  it('reports a failed test notification without claiming delivery', async () => {
    mocks.invoke.mockResolvedValue('granted')
    await mount()
    await act(async () => toggle(0).click())
    mocks.invoke.mockImplementation(async (command) => {
      if (command === 'plugin:notification|notify') throw new Error('OS unavailable')
      return 'granted'
    })
    await clickText('Send test notification')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('OS unavailable')
    expect(container.textContent).not.toContain('Sent to the system')
  })
})
