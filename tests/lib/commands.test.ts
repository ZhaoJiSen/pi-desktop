import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  request: vi.fn(),
  state: {
    activeSessionId: 's',
    piExecutable: 'pi',
    connection: 'connected',
    runningSessionId: null as string | null,
    sessions: [{ id: 's', draft: 'keep my draft' }],
    updateSession: vi.fn(),
  },
  setState: vi.fn(),
  navigateToPage: vi.fn(),
}))
vi.mock('../../src/router/navigation', () => ({ navigateToPage: mocks.navigateToPage }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('../../src/lib/desktop', () => ({ request: mocks.request }))
vi.mock('../../src/store/workspace', () => ({
  isDesktop: true,
  useWorkspace: { getState: () => mocks.state, setState: mocks.setState },
}))
import {
  commandCapability,
  discoverCommands,
  filterCommands,
  insertCommand,
  type DiscoverableCommand,
} from '../../src/lib/commands'
const extension: DiscoverableCommand = {
  name: 'review',
  description: 'Check changes',
  source: 'extension',
  sourceInfo: { source: 'npm:review-package' },
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.activeSessionId = 's'
  mocks.state.runningSessionId = null
  mocks.state.connection = 'connected'
})
describe('command capabilities', () => {
  it('never treats terminal commands as executable prompts', () => {
    expect(commandCapability({ name: 'tree', source: 'builtin' })).toBe('terminal')
    expect(commandCapability({ name: 'compact', source: 'builtin' })).toBe('execute')
    expect(commandCapability({ name: 'model', source: 'builtin' })).toBe('navigate')
    expect(commandCapability(extension)).toBe('insert')
  })
  it('searches descriptions and runtime source with source filters', () => {
    expect(filterCommands([extension], 'CHANGES', 'all')).toEqual([extension])
    expect(filterCommands([extension], 'review-package', 'extension')).toEqual([extension])
    expect(filterCommands([extension], '', 'builtin')).toEqual([])
    expect(filterCommands([extension], '扩展', 'all', { extension: '扩展' })).toEqual([extension])
  })
  it('preserves draft and refuses terminal commands or busy sessions', () => {
    expect(insertCommand(extension)).toBe(true)
    expect(mocks.state.updateSession).toHaveBeenCalledWith('s', { draft: '/review keep my draft' })
    expect(mocks.navigateToPage).toHaveBeenCalledWith('chat')
    expect(insertCommand({ name: 'quit', source: 'builtin' })).toBe(false)
    mocks.state.runningSessionId = 's'
    expect(insertCommand(extension)).toBe(false)
  })
  it('merges installed official definitions with actual loaded runtime commands', async () => {
    mocks.invoke.mockResolvedValue([{ name: 'compact', source: 'builtin' }])
    mocks.request.mockResolvedValue({ commands: [extension] })
    expect(await discoverCommands()).toEqual([{ name: 'compact', source: 'builtin' }, extension])
    expect(mocks.request).toHaveBeenCalledWith({ type: 'get_commands' })
    expect(mocks.invoke).toHaveBeenCalledWith('builtin_commands', { executable: 'pi' })
  })
  it('discards a response if the session switched during discovery', async () => {
    mocks.invoke.mockResolvedValue([])
    mocks.request.mockImplementation(async () => {
      mocks.state.activeSessionId = 'new'
      return { commands: [extension] }
    })
    expect(await discoverCommands()).toEqual([])
    expect(mocks.setState).not.toHaveBeenCalled()
  })
})
