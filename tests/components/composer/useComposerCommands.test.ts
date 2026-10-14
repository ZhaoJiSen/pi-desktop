// @vitest-environment happy-dom
import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiscoverableCommand } from '../../../src/lib/commands'

const mocks = vi.hoisted(() => ({
  desktop: false,
  state: {
    commands: [{ name: 'stale', source: 'extension' as const }],
    piExecutable: 'pi',
    connection: 'disconnected',
    language: 'zh',
  },
  loadBuiltin: vi.fn<() => Promise<DiscoverableCommand[]>>(),
  preview: vi.fn((language: string): DiscoverableCommand[] => [
    { name: 'skill:commit', source: 'skill', description: language },
  ]),
}))
vi.mock('../../../src/store/workspace', () => ({
  get isDesktop() {
    return mocks.desktop
  },
  useWorkspace: (select: (state: typeof mocks.state) => unknown) => select(mocks.state),
}))
vi.mock('../../../src/lib/commands', () => ({ loadBuiltinCommands: mocks.loadBuiltin }))
vi.mock('../../../src/lib/fixtures', () => ({ getPreviewCommands: mocks.preview }))
vi.mock('../../../src/lib/i18n', () => ({ useT: () => (key: string) => key }))
import { useComposerCommands } from '../../../src/components/composer/useComposerCommands'

let root: Root, container: HTMLDivElement
let catalog: ReturnType<typeof useComposerCommands>
function Probe() {
  const value = useComposerCommands()
  useEffect(() => {
    catalog = value
  }, [value])
  return null
}
async function mount() {
  await act(async () => root.render(createElement(Probe)))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.desktop = false
  mocks.state.connection = 'disconnected'
  mocks.state.language = 'zh'
  mocks.loadBuiltin.mockReset().mockResolvedValue([{ name: 'model', source: 'builtin' }])
  mocks.preview.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
describe('composer command catalog', () => {
  it('uses the localized preview catalog in the browser without querying the desktop', async () => {
    await mount()
    expect(catalog).toMatchObject({
      commands: [{ name: 'skill:commit', description: 'zh' }],
      loading: false,
      catalogError: '',
    })
    expect(mocks.loadBuiltin).not.toHaveBeenCalled()
    mocks.state.language = 'en'
    await mount()
    expect(catalog.commands[0]?.description).toBe('en')
  })
  it('combines desktop builtins with connected runtime commands', async () => {
    mocks.desktop = true
    mocks.state.connection = 'connected'
    await mount()
    expect(catalog.commands.map((command) => command.name)).toEqual(['model', 'stale'])
    expect(catalog.loading).toBe(false)
    expect(mocks.preview).not.toHaveBeenCalled()
  })
  it('hides stale runtime commands while reconnecting and reports catalog failures', async () => {
    mocks.desktop = true
    mocks.state.connection = 'connecting'
    mocks.loadBuiltin.mockRejectedValue(new Error('offline'))
    await mount()
    expect(catalog.commands).toEqual([])
    expect(catalog.loading).toBe(true)
    expect(catalog.catalogError).toBe('commands.catalogUnavailable')
  })
})
