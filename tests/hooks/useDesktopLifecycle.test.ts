// @vitest-environment happy-dom
import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  language: vi.fn(),
  sync: vi.fn(),
  connect: vi.fn(),
}))
vi.mock('../../src/lib/desktop', () => ({
  initializeDesktop: mocks.initialize,
  initializeLanguage: mocks.language,
  syncDesktopLanguage: mocks.sync,
  connectSession: mocks.connect,
}))
vi.mock('../../src/store/workspace', async (original) => {
  const module = await original<typeof import('../../src/store/workspace')>()
  return {
    ...module,
    isDesktop: true,
    useWorkspace: module.createWorkspaceStore({
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }),
  }
})
import { useWorkspace } from '../../src/store/workspace'
import { useDesktopLifecycle } from '../../src/hooks/useDesktopLifecycle'
let root: Root, container: HTMLDivElement, lifecycle: ReturnType<typeof useDesktopLifecycle>
function Probe({ enabled }: { enabled: boolean }) {
  const current = useDesktopLifecycle('chat', enabled)
  useEffect(() => {
    lifecycle = current
  })
  return createElement('span', null, current.startup)
}
async function render(enabled: boolean) {
  await act(async () => root.render(createElement(Probe, { enabled })))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
  for (const mock of Object.values(mocks)) mock.mockReset().mockResolvedValue(undefined)
  useWorkspace.setState({ activeSessionId: 'first', connection: 'disconnected' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
describe('onboarding startup boundary', () => {
  it('sets locale and theme during setup without connecting Pi', async () => {
    await render(false)
    expect(mocks.language).toHaveBeenCalledOnce()
    expect(mocks.initialize).not.toHaveBeenCalled()
    expect(mocks.connect).not.toHaveBeenCalled()
  })
  it('starts Pi only after the guide is completed', async () => {
    await render(false)
    await act(async () => lifecycle.finishOnboarding(true))
    await render(true)
    expect(mocks.initialize).toHaveBeenCalledOnce()
    expect(mocks.connect).toHaveBeenCalledWith('first')
    expect(lifecycle.startup).toBe('ready')
  })
  it('skips Pi startup offline but restores session switching after a manual connection', async () => {
    await render(false)
    await act(async () => lifecycle.finishOnboarding(false))
    await render(true)
    expect(mocks.initialize).not.toHaveBeenCalled()
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(lifecycle.startup).toBe('ready')
    await act(async () =>
      useWorkspace.setState({ connection: 'connected', activeSessionId: 'second' }),
    )
    expect(mocks.connect).toHaveBeenCalledWith('second')
  })
  it('does not reconnect repeatedly when normal runtime connection status changes', async () => {
    await render(true)
    expect(mocks.connect).toHaveBeenCalledOnce()
    await act(async () => useWorkspace.setState({ connection: 'connecting' }))
    await act(async () => useWorkspace.setState({ connection: 'error' }))
    expect(mocks.connect).toHaveBeenCalledOnce()
  })
  it('keeps connection failures in the startup screen and allows retry', async () => {
    mocks.initialize.mockRejectedValueOnce(new Error('RPC unavailable'))
    await render(false)
    await act(async () => lifecycle.finishOnboarding(true))
    await render(true)
    expect(lifecycle.startup).toBe('error')
    expect(lifecycle.startupError).toBe('RPC unavailable')
    expect(mocks.connect).not.toHaveBeenCalled()
    await act(async () => lifecycle.retryStartup())
    expect(lifecycle.startup).toBe('ready')
  })
})
