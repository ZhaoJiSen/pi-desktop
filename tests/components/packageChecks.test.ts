// @vitest-environment happy-dom
import { act, createElement, StrictMode, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtensionPackage } from '../../src/types'
import type { PackageInfo } from '../../src/lib/packages'

const mocks = vi.hoisted(() => ({
  state: {
    packages: [] as ExtensionPackage[],
    activeSessionId: 'session',
    projects: [{ id: 'project', path: '/project' }],
    sessions: [{ id: 'session', projectId: 'project' }],
    runningSessionId: null,
    connection: 'connected',
    language: 'en',
    autoReloadAfterUpdate: false,
    autoReloadAfterToggle: true,
  },
}))
vi.mock('../../src/store/workspace', () => ({
  useWorkspace: Object.assign(
    (select: (state: typeof mocks.state) => unknown) => select(mocks.state),
    {
      getState: () => mocks.state,
    },
  ),
}))
vi.mock('../../src/lib/desktop', () => ({
  refreshExtensionPackages: vi.fn(),
  connectSession: vi.fn(),
}))
import { PackageServices } from '../../src/components/extension-packages/services'
import { PackageUpdateSummary } from '../../src/components/extension-packages/PackageUpdateSummary'
import { PackageLibrary } from '../../src/components/extension-packages/PackageLibrary'
import {
  useExtensionPackages,
  type ExtensionPackagesController,
} from '../../src/components/extension-packages/useExtensionPackages'

const pkg = (name: string): ExtensionPackage => ({
  source: `npm:${name}`,
  scope: 'global',
  version: '1.0.0',
})
const metadata = (name: string): PackageInfo => ({
  name,
  version: '1.0.0',
  description: '',
  author: '',
  license: '',
  resources: [],
  newerThan: [],
})
let root: Root
let container: HTMLDivElement
let current: ExtensionPackagesController
let services: React.ContextType<typeof PackageServices>
let renderLibrary = false

function Probe() {
  const controller = useExtensionPackages()
  useEffect(() => {
    current = controller
  })
  return renderLibrary
    ? createElement(PackageLibrary, {
        ...controller.library,
        packageCount: controller.packageCount,
        changeMode: controller.changeMode,
        feedback: controller.feedback,
      })
    : createElement(PackageUpdateSummary, controller.library.updates)
}
async function mount() {
  await act(async () => {
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(PackageServices.Provider, { value: services }, createElement(Probe)),
      ),
    )
  })
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  renderLibrary = false
  mocks.state.autoReloadAfterToggle = true
  mocks.state.packages = [pkg('demo')]
  services = {
    browsePackages: vi.fn(async () => ({ items: [], hasNext: false })),
    discoverPackages: vi.fn(async () => []),
    packageMetadata: vi.fn(async () => []),
    packageInfo: vi.fn(async (name: string) => metadata(name)),
    managePackage: vi.fn(async () => {}),
    refreshExtensionPackages: vi.fn(async () => []),
    connectSession: vi.fn(async () => {}),
  }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

describe('HeroUI package list', () => {
  async function mountList() {
    renderLibrary = true
    mocks.state.packages = [pkg('alpha'), pkg('bravo'), pkg('charlie')]
    await mount()
    return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'))
  }

  it('uses single-select listbox options and updates details when clicked', async () => {
    const options = await mountList()
    expect(container.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe(
      'Installed',
    )
    expect(options).toHaveLength(3)
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
    expect(options[1]?.querySelector('button')).toBeNull()
    await act(async () => options[1]!.querySelector('strong')!.click())
    expect(current.library.item?.source).toBe('npm:bravo')
    expect(options[1]?.getAttribute('aria-selected')).toBe('true')
    expect(options[0]?.getAttribute('aria-selected')).toBe('false')
  })

  it('supports arrow navigation and package-name typeahead', async () => {
    const options = await mountList()
    await act(async () => {
      options[0]!.focus()
      options[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(current.library.item?.source).toBe('npm:bravo')
    expect(document.activeElement).toBe(options[1])
    await act(async () => {
      options[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }))
    })
    expect(document.activeElement).toBe(options[2])
    await act(async () => {
      options[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      options[2]!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    })
    expect(current.library.item?.source).toBe('npm:charlie')
  })

  it('refreshes cached option content when async update metadata arrives', async () => {
    let resolveLookup: (value: PackageInfo) => void = () => {}
    const lookup = new Promise<PackageInfo>((resolve) => {
      resolveLookup = resolve
    })
    services.packageInfo = vi.fn(async (name: string) =>
      name === 'alpha' ? lookup : metadata(name),
    )
    const options = await mountList()
    expect(options[0]?.textContent).not.toContain('→ v2.0.0')
    await act(async () => {
      resolveLookup({ ...metadata('alpha'), version: '2.0.0', newerThan: ['1.0.0'] })
    })
    expect(options[0]?.textContent).toContain('→ v2.0.0')
    expect(options[0]?.querySelector('.package-update-dot')).not.toBeNull()
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('installed package check effects', () => {
  it('forces one request per manual check, then reuses it on tab changes and remounts in StrictMode', async () => {
    await mount()
    expect(services.packageInfo).toHaveBeenCalledTimes(1)
    await act(async () => current.library.updates.checkUpdates())
    expect(services.packageInfo).toHaveBeenCalledTimes(2)
    await act(async () => current.changeMode('discover'))
    await act(async () => current.changeMode('installed'))
    expect(services.packageInfo).toHaveBeenCalledTimes(2)
    await act(async () => current.library.updates.checkUpdates())
    expect(services.packageInfo).toHaveBeenCalledTimes(3)
    await act(async () => root.unmount())
    root = createRoot(container)
    await mount()
    expect(services.packageInfo).toHaveBeenCalledTimes(3)
    expect(current.library.updates.checking).toBe(false)
  })

  it('shows failure, rather than up-to-date, when no registry checks succeeded', async () => {
    services.packageInfo = vi.fn(async () => {
      throw new Error('offline')
    })
    await mount()
    expect(container.textContent).toContain('Update check failed. Please retry')
    expect(container.textContent).not.toContain('up to date')
    expect(current.library.updates.checkSummary.compared).toBe(0)
  })

  it('shows partial completion when one check succeeded and another failed', async () => {
    mocks.state.packages = [pkg('demo'), pkg('broken')]
    services.packageInfo = vi.fn(async (name: string) => {
      if (name === 'broken') throw new Error('offline')
      return metadata(name)
    })
    await mount()
    expect(container.textContent).toContain('Checked 1 packages; remaining checks incomplete')
    expect(container.textContent).not.toContain('up to date')
  })
})

describe('extension toggle reload feedback', () => {
  it('clears pending feedback after automatically reloading', async () => {
    await mount()
    const checks = vi.mocked(services.packageInfo).mock.calls.length
    await act(async () => current.detail.perform('disable', pkg('demo')))
    expect(vi.mocked(services.packageInfo).mock.calls.length).toBe(checks)
    expect(current.library.updates.checking).toBe(false)
    expect(services.connectSession).toHaveBeenCalledWith('session', true)
    expect(current.feedback.notice).toBe('')
    expect(current.feedback.changed).toBe(false)
    expect(current.toast.changed).toBe(false)
    expect(current.toast.message).toBe('Pi reloaded. Changes are now applied.')
  })
  it('keeps manual reload in the toast when automatic reload is disabled', async () => {
    mocks.state.autoReloadAfterToggle = false
    await mount()
    await act(async () => current.detail.perform('enable', pkg('demo')))
    expect(services.connectSession).not.toHaveBeenCalled()
    expect(current.feedback.notice).toBe('')
    expect(current.feedback.changed).toBe(false)
    expect(current.toast.changed).toBe(true)
    await act(async () => current.toast.reload())
    expect(current.toast.changed).toBe(false)
    expect(current.toast.message).toBe('Pi reloaded. Changes are now applied.')
  })
})
