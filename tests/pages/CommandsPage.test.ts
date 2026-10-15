// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../src/components/ModelSelector', () => ({ ModelSelector: () => null }))
vi.mock('../../src/router/navigation', () => ({ navigateToPage: vi.fn() }))
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))
import { CommandsPage } from '../../src/pages/CommandsPage'
import { useWorkspace } from '../../src/store/workspace'
import type { DiscoverableCommand } from '../../src/lib/commands'
import type { SlashCommand } from '../../src/types'
import { SidebarWidthProvider } from '../../src/layouts/SidebarLayout'

const commands: DiscoverableCommand[] = [
  { name: 'compact', source: 'builtin', description: 'Compact context' },
  { name: 'review', source: 'extension', description: 'Review changes' },
]
let root: Root, container: HTMLDivElement
let services: NonNullable<React.ComponentProps<typeof CommandsPage>['services']>
async function mount() {
  await act(async () =>
    root.render(
      createElement(SidebarWidthProvider, null, createElement(CommandsPage, { services })),
    ),
  )
}
function action() {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent === 'Compact context',
  )!
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  useWorkspace.setState({
    activeSessionId: 'model-selector',
    language: 'en',
    connection: 'connected',
    runningSessionId: null,
    commands: commands.filter((c) => c.source !== 'builtin') as SlashCommand[],
  })
  services = {
    desktop: true,
    discover: vi.fn(async () => commands),
    request: vi.fn().mockResolvedValue({}),
    syncSession: vi.fn(async () => {}),
  }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
describe('command center actions', () => {
  it('waits for the complete catalog before selecting the initial command', async () => {
    let finish!: (value: DiscoverableCommand[]) => void
    services.discover = vi.fn(
      () => new Promise<DiscoverableCommand[]>((resolve) => (finish = resolve)),
    )
    useWorkspace.setState({
      commands: [{ name: 'websearch', source: 'extension', description: 'Search the web' }],
    })
    await mount()
    expect(container.querySelector('.command-inspector')).toBeNull()
    expect(container.querySelector('.command-row')).toBeNull()
    await act(async () =>
      finish([{ name: 'settings', source: 'builtin', description: 'Open settings' }]),
    )
    expect(container.querySelector('.command-inspector h3')?.textContent).toBe('/settings')
    expect(container.querySelectorAll('.command-row')).toHaveLength(2)
  })
  it('does not show the previous catalog while the next session catalog loads', async () => {
    await mount()
    let finish!: (value: DiscoverableCommand[]) => void
    services.discover = vi.fn(
      () => new Promise<DiscoverableCommand[]>((resolve) => (finish = resolve)),
    )
    await act(async () => useWorkspace.setState({ activeSessionId: 'files' }))
    expect(container.querySelector('.command-inspector')).toBeNull()
    await act(async () =>
      finish([{ name: 'settings', source: 'builtin', description: 'Open settings' }]),
    )
    expect(container.querySelector('.command-inspector h3')?.textContent).toBe('/settings')
  })
  it('allows retry when the initial catalog fails to load', async () => {
    services.discover = vi
      .fn()
      .mockRejectedValueOnce(new Error('Catalog unavailable'))
      .mockResolvedValue(commands)
    await mount()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Catalog unavailable')
    expect(container.querySelector('.command-inspector')).toBeNull()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!.click(),
    )
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('.command-inspector h3')?.textContent).toBe('/compact')
  })
  it('keeps the source group while searching and shows the source again in the detail', async () => {
    await mount()
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-controls="commands-browser-search"]')!
        .click(),
    )
    const input = container.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        'review',
      )
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelectorAll('.command-row')).toHaveLength(1)
    expect(container.querySelector('.commands-group-heading span')?.textContent).toBe('Extension')
    expect(container.querySelector('.command-summary')?.textContent).toBe('Review changes')
    expect(container.querySelector('.command-source')?.textContent).toBe('Extension')
  })
  it('retains the catalog and allows retry after compaction fails', async () => {
    services.request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Compaction failed'))
      .mockResolvedValue({})
    await mount()
    await act(async () => action().click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Compaction failed')
    expect(container.querySelectorAll('.command-row')).toHaveLength(2)
    expect(action().disabled).toBe(false)
    await act(async () => action().click())
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Context compacted')
  })
  it('prevents two simultaneous compact requests before React renders', async () => {
    let done!: (value: unknown) => void
    services.request = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          done = resolve
        }),
    )
    await mount()
    await act(async () => {
      action().click()
      action().click()
    })
    expect(services.request).toHaveBeenCalledTimes(1)
    await act(async () => done({}))
  })
  it('does not show a prior session action failure in the newly selected session', async () => {
    let fail!: (error: Error) => void
    services.request = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject
        }),
    )
    await mount()
    await act(async () => action().click())
    await act(async () =>
      useWorkspace.setState({ activeSessionId: 'files', runningSessionId: null }),
    )
    await act(async () => fail(new Error('Old session failed')))
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelectorAll('.command-row')).toHaveLength(2)
  })
})
