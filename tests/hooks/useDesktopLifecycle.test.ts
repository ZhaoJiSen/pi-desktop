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
  theme: vi.fn(),
}))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    setBackgroundColor: mocks.background,
    setEffects: vi.fn().mockResolvedValue(undefined),
    clearEffects: vi.fn().mockResolvedValue(undefined),
    setTheme: mocks.theme,
  }),
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
function systemAppearance(dark: boolean, override: 'light' | 'dark' | null = null) {
  const media = new EventTarget()
  Object.defineProperty(media, 'matches', {
    get: () => (override === null ? dark : override === 'dark'),
  })
  vi.stubGlobal('matchMedia', () => media)
  mocks.theme.mockImplementation(async (theme: 'light' | 'dark' | null) => {
    override = theme
    media.dispatchEvent(new Event('change'))
  })
  return (value: boolean) => {
    dark = value
    media.dispatchEvent(new Event('change'))
  }
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
  it('releases a stale native dark override when restoring the system preference', async () => {
    systemAppearance(false, 'dark')
    useWorkspace.setState({ theme: 'system' })
    await render(false)
    expect(mocks.theme).toHaveBeenCalledWith(null)
    expect(document.documentElement.dataset.theme).toBe('light')
  })
  it('returns to system tracking even when the resolved color does not change', async () => {
    const changeSystem = systemAppearance(true)
    useWorkspace.setState({
      theme: 'dark',
      palettesByMode: { light: 'nord', dark: 'catppuccin' },
    })
    await render(false)
    expect(mocks.theme).toHaveBeenLastCalledWith('dark')
    await act(async () => useWorkspace.getState().setPreference({ theme: 'system' }))
    expect(mocks.theme).toHaveBeenLastCalledWith(null)
    expect(document.documentElement.dataset.theme).toBe('dark')
    await act(async () => changeSystem(false))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.palette).toBe('nord')
    await act(async () => changeSystem(true))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.palette).toBe('catppuccin')
    expect(useWorkspace.getState().theme).toBe('system')
    expect(mocks.theme.mock.calls.slice(1).every(([theme]) => theme === null)).toBe(true)
  })
  it('keeps an explicit theme until the user switches back to system', async () => {
    const changeSystem = systemAppearance(false)
    useWorkspace.setState({ theme: 'dark' })
    await render(false)
    await act(async () => changeSystem(true))
    await act(async () => changeSystem(false))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(mocks.theme).toHaveBeenLastCalledWith('dark')
    await act(async () => useWorkspace.getState().setPreference({ theme: 'system' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(mocks.theme).toHaveBeenLastCalledWith(null)
  })
  it('keeps the native window transparent when the theme or palette changes', async () => {
    await render(false)
    expect(mocks.background).toHaveBeenCalledWith([0, 0, 0, 0])
    expect(mocks.theme).toHaveBeenCalledWith('light')
    await act(async () => useWorkspace.setState({ theme: 'dark' }))
    expect(mocks.theme).toHaveBeenLastCalledWith('dark')
    await act(async () =>
      useWorkspace.setState({
        palettesByMode: { light: 'ink', dark: 'catppuccin' },
      }),
    )
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.palette).toBe('catppuccin')
    expect(document.documentElement.dataset.material).toBe('blur')
    expect(mocks.background.mock.calls.every((call) => String(call[0]) === '0,0,0,0')).toBe(true)
    await act(async () => useWorkspace.setState({ connection: 'connecting' }))
    expect(mocks.theme).toHaveBeenLastCalledWith('dark')
  })
  it('keeps the workspace usable if the native background update fails', async () => {
    mocks.background.mockRejectedValueOnce(new Error('Native color unavailable'))
    await render(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(lifecycle.startup).toBe('loading')
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
