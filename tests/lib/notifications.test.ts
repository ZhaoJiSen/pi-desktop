// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  action: vi.fn(),
  focus: vi.fn(async () => {}),
  show: vi.fn(async () => {}),
  unminimize: vi.fn(async () => {}),
  attention: vi.fn(async () => {}),
  granted: vi.fn(),
  request: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: mocks.granted,
  requestPermission: mocks.request,
  onAction: mocks.action,
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setFocus: mocks.focus,
    show: mocks.show,
    unminimize: mocks.unminimize,
    requestUserAttention: mocks.attention,
  }),
  UserAttentionType: { Informational: 2 },
}))
vi.mock('../../src/store/workspace', async (original) => ({
  ...(await original<typeof import('../../src/store/workspace')>()),
  isDesktop: true,
}))
import {
  focusApplication,
  listenNotificationActions,
  readNotificationPermission,
  requestQuestionAttention,
  showQuestionNotification,
} from '../../src/lib/notifications'
import { defaultNotificationPreferences } from '../../src/lib/notificationPreferences'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.invoke.mockResolvedValue('granted')
})
describe('native notification bridge', () => {
  it('uses actual macOS permission without trusting the desktop plugin grant', async () => {
    mocks.invoke.mockResolvedValueOnce('denied')
    expect(await readNotificationPermission()).toBe('denied')
    expect(mocks.granted).not.toHaveBeenCalled()
    expect(mocks.request).not.toHaveBeenCalled()
    await readNotificationPermission(true)
    expect(mocks.invoke).toHaveBeenLastCalledWith('notification_permission', { request: true })
  })
  it('does not send denied or already-resolved requests, and awaits send errors', async () => {
    mocks.invoke.mockResolvedValueOnce('denied')
    await expect(
      showQuestionNotification('body', 'q', defaultNotificationPreferences),
    ).rejects.toThrow()
    await showQuestionNotification('body', 'q', defaultNotificationPreferences, () => false)
    expect(
      mocks.invoke.mock.calls.some(([command]) => command === 'plugin:notification|notify'),
    ).toBe(false)
    mocks.invoke.mockImplementation(async (command) => {
      if (command === 'plugin:notification|notify') throw new Error('Unable to send')
      return 'granted'
    })
    await expect(
      showQuestionNotification('body', 'q', defaultNotificationPreferences),
    ).rejects.toThrow('Unable to send')
  })
  it('includes only the selected preview and a click correlation key, with no default sound', async () => {
    await showQuestionNotification(
      'Conversation is waiting',
      'run:q',
      defaultNotificationPreferences,
    )
    expect(mocks.invoke).toHaveBeenLastCalledWith('plugin:notification|notify', {
      options: expect.objectContaining({
        body: 'Conversation is waiting',
        sound: undefined,
        extra: { questionKey: 'run:q' },
      }),
    })
  })
  it('correlates native clicks and brings back the app only on explicit activation', async () => {
    let callback!: (event: unknown) => void
    mocks.action.mockImplementationOnce(async (fn) => {
      callback = fn
      return { unregister: vi.fn() }
    })
    const open = vi.fn()
    await listenNotificationActions(open)
    callback({ notification: null })
    callback({ notification: { extra: { questionKey: 'run:q' } } })
    expect(open).toHaveBeenCalledExactlyOnceWith('run:q')
    await requestQuestionAttention()
    expect(mocks.attention).toHaveBeenCalledWith(2)
    expect(mocks.focus).not.toHaveBeenCalled()
    await focusApplication()
    expect(mocks.unminimize).toHaveBeenCalledOnce()
    expect(mocks.show).toHaveBeenCalledOnce()
    expect(mocks.focus).toHaveBeenCalledOnce()
  })
})
