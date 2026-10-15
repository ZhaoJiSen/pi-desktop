// @vitest-environment happy-dom
import { act, createElement, useEffect, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ check: vi.fn(), claim: vi.fn(), suppress: vi.fn() }))
vi.mock('../../src/lib/piUpdates', () => ({
  checkPiUpdate: mocks.check,
  claimPiUpdatePrompt: mocks.claim,
  suppressPiUpdatePrompt: mocks.suppress,
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
import { usePiUpdatePrompt } from '../../src/hooks/usePiUpdatePrompt'
import { useWorkspace } from '../../src/store/workspace'
const offer = {
  executable: '/pi',
  currentVersion: '1.0.0',
  latestVersion: '1.2.0',
  hasUpdate: true,
}
let root: Root, container: HTMLDivElement, current: ReturnType<typeof usePiUpdatePrompt>
function Probe({ ready = true, guide = false, blocked = false }) {
  const value = usePiUpdatePrompt(ready, guide, blocked)
  useEffect(() => {
    current = value
  })
  return createElement('span', null, value.update?.latestVersion || 'quiet')
}
async function render(
  props: { ready?: boolean; guide?: boolean; blocked?: boolean } = {},
  strict = false,
) {
  await act(async () =>
    root.render(
      strict
        ? createElement(StrictMode, null, createElement(Probe, props))
        : createElement(Probe, props),
    ),
  )
}
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(350)
  })
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.check.mockReset().mockResolvedValue(offer)
  mocks.claim.mockReset().mockResolvedValue(true)
  mocks.suppress.mockReset().mockResolvedValue(undefined)
  useWorkspace.setState({
    piExecutable: '/pi',
    piUpdating: false,
    piBusyRuns: [],
    runningSessionId: null,
    connection: 'connected',
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('automatic Pi update prompt', () => {
  it('checks after ready and claims the prompt once across rerenders', async () => {
    await render({ ready: false })
    expect(mocks.check).not.toHaveBeenCalled()
    await render()
    await settle()
    expect(current.update).toEqual(offer)
    await render({ blocked: true })
    await render()
    await settle()
    expect(mocks.claim).toHaveBeenCalledOnce()
    await act(async () => current.dismiss())
    await render()
    await settle()
    expect(current.update).toBeNull()
  })
  it('does not duplicate prompts in StrictMode', async () => {
    await render({}, true)
    await settle()
    expect(mocks.claim).toHaveBeenCalledOnce()
  })
  it('suppresses startup prompts after completing or skipping the guide', async () => {
    await render({ ready: false, guide: true })
    await render({ ready: true, guide: false })
    await settle()
    expect(mocks.suppress).toHaveBeenCalled()
    expect(mocks.check).not.toHaveBeenCalled()
    expect(current.update).toBeNull()
  })
  it('honors native suppression after a webview remount', async () => {
    mocks.claim.mockResolvedValue(false)
    await render()
    await settle()
    expect(current.update).toBeNull()
  })
  it('defers presentation until background tasks and other dialogs have finished', async () => {
    useWorkspace.setState({ piBusyRuns: ['background'] })
    await render()
    await settle()
    expect(mocks.check).toHaveBeenCalledOnce()
    expect(mocks.claim).not.toHaveBeenCalled()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    await act(async () => useWorkspace.setState({ piBusyRuns: [] }))
    await settle()
    expect(mocks.claim).not.toHaveBeenCalled()
    await act(async () => {
      dialog.remove()
      await Promise.resolve()
    })
    await settle()
    expect(current.update).toEqual(offer)
  })
  it('silently ignores offline failures, invalid responses and an up-to-date installation', async () => {
    mocks.check.mockRejectedValueOnce(new Error('offline'))
    await render()
    await settle()
    expect(current.update).toBeNull()
    expect(mocks.claim).not.toHaveBeenCalled()
    mocks.check.mockResolvedValue({ ...offer, hasUpdate: false })
    await act(async () => useWorkspace.setState({ piExecutable: '/another-pi' }))
    await settle()
    expect(current.update).toBeNull()
  })
  it('ignores the late result for an executable that is no longer selected', async () => {
    let complete!: (value: typeof offer) => void
    mocks.check.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    await render()
    mocks.check.mockResolvedValue({ ...offer, hasUpdate: false })
    await act(async () => useWorkspace.setState({ piExecutable: '/new-pi' }))
    await act(async () => complete(offer))
    await settle()
    expect(current.update).toBeNull()
    expect(mocks.claim).not.toHaveBeenCalled()
  })
})
