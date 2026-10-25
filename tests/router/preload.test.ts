import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  route: vi.fn(),
  chat: vi.fn(),
  settings: vi.fn(),
  git: vi.fn(),
  usage: vi.fn(),
}))
vi.mock('../../src/router/index', () => ({ router: { preloadRoute: mocks.route } }))
vi.mock('../../src/router/pageComponents', () => ({
  ChatPage: { preload: mocks.chat },
  SettingsPage: { preload: mocks.settings },
  GitPage: { preload: mocks.git },
  UsagePage: { preload: mocks.usage },
}))
import { preloadPage } from '../../src/router/preload'
beforeEach(() => {
  vi.resetAllMocks()
})
it('prepares retained pages and router-owned pages without navigating', () => {
  preloadPage('chat')
  preloadPage('settings')
  preloadPage('usage')
  preloadPage('git')
  preloadPage('commands')
  expect(mocks.chat).toHaveBeenCalledOnce()
  expect(mocks.settings).toHaveBeenCalledOnce()
  expect(mocks.usage).toHaveBeenCalledOnce()
  expect(mocks.git).toHaveBeenCalledOnce()
  expect(mocks.route).toHaveBeenCalledExactlyOnceWith({ to: '/commands' })
})
it('tolerates failed speculative loads so a later navigation can retry', async () => {
  mocks.route.mockRejectedValueOnce(new Error('offline'))
  expect(preloadPage('commands')).toBeUndefined()
  await Promise.resolve()
  preloadPage('commands')
  expect(mocks.route).toHaveBeenCalledTimes(2)
})
