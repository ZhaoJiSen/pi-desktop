// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ focused: vi.fn(), listen: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ isFocused: native.focused, onFocusChanged: native.listen }),
}))
vi.mock('../../src/store/workspace', () => ({ isDesktop: true }))
import { useAppForeground } from '../../src/hooks/useAppForeground'

it('does not overwrite a newer blur event with a stale initial native focus query, and removes its listener', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let resolve!: (focused: boolean) => void
  const stop = vi.fn()
  native.focused.mockReturnValue(
    new Promise<boolean>((done) => {
      resolve = done
    }),
  )
  native.listen.mockResolvedValue(stop)
  const element = document.createElement('div')
  document.body.append(element)
  const root = createRoot(element)
  function Probe() {
    return h('p', null, String(useAppForeground()))
  }
  try {
    await act(async () => root.render(h(Probe)))
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(element.textContent).toBe('true')
    await act(async () => window.dispatchEvent(new Event('blur')))
    await act(async () => resolve(true))
    expect(element.textContent).toBe('false')
    await act(async () => root.unmount())
    expect(stop).toHaveBeenCalledOnce()
  } finally {
    element.remove()
    vi.unstubAllGlobals()
  }
})
