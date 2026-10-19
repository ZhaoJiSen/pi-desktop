// @vitest-environment happy-dom
import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  language: vi.fn(),
  sync: vi.fn(),
  connect: vi.fn(),
  background: vi.fn(),
}))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({ setBackgroundColor: mocks.background }),
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
let root: Root,
  container: HTMLDivElement,
  appearanceStyle: HTMLStyleElement,
  lifecycle: ReturnType<typeof useDesktopLifecycle>
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
  useWorkspace.setState({
    activeSessionId: 'first',
    connection: 'disconnected',
    theme: 'light',
    palettesByMode: { light: 'ink', dark: 'ink' },
    accentOverrides: {},
  })
  appearanceStyle = document.createElement('style')
  appearanceStyle.textContent = `
    html { --ground: #f7f7f6; }
    html[data-theme='dark'] { --ground: #1b1c1d; }
    html[data-theme='dark'][data-palette='catppuccin'] { --ground: #181825; }
  `
  document.head.append(appearanceStyle)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  appearanceStyle.remove()
  vi.unstubAllGlobals()
})
describe('onboarding startup boundary', () => {
  it('keeps native resize backing in sync with the resolved mode and palette', async () => {
    await render(false)
    expect(mocks.background).toHaveBeenLastCalledWith('#f7f7f6')
    await act(async () => useWorkspace.setState({ theme: 'dark' }))
    expect(mocks.background).toHaveBeenLastCalledWith('#1b1c1d')
    await act(async () =>
      useWorkspace.setState({
        palettesByMode: { light: 'ink', dark: 'catppuccin' },
      }),
    )
    expect(mocks.background).toHaveBeenLastCalledWith('#181825')
    const calls = mocks.background.mock.calls.length
    await act(async () => useWorkspace.setState({ connection: 'connecting' }))
    expect(mocks.background).toHaveBeenCalledTimes(calls)
  })
  it('keeps the workspace usable if the native background update fails', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.background.mockRejectedValueOnce(new Error('Native color unavailable'))
    try {
      await render(false)
      expect(document.documentElement.dataset.theme).toBe('light')
      expect(warning).toHaveBeenCalledOnce()
      expect(lifecycle.startup).toBe('loading')
    } finally {
      warning.mockRestore()
    }
  })
  it('flushes pending persistence when the page is hidden or leaves the webview', async () => {
    const flush = vi.spyOn(useWorkspace, 'flushPersistence')
    await render(false)
    window.dispatchEvent(new Event('pagehide'))
    expect(flush).toHaveBeenCalledOnce()
    const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(flush).toHaveBeenCalledTimes(2)
    if (visibility) Object.defineProperty(document, 'visibilityState', visibility)
    else Reflect.deleteProperty(document, 'visibilityState')
    flush.mockRestore()
  })
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
  it('ignores a startup failure after the guide is reopened and skipped', async () => {
    let reject!: (error: Error) => void
    mocks.initialize.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail
      }),
    )
    await render(true)
    await render(false)
    await act(async () => lifecycle.finishOnboarding(false))
    await render(true)
    await act(async () => reject(new Error('Previous startup failed')))
    expect(lifecycle.startup).toBe('ready')
    expect(lifecycle.startupError).toBeNull()
    expect(mocks.connect).not.toHaveBeenCalled()
  })
})
