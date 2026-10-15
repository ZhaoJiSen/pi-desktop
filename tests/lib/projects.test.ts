import { beforeEach, describe, expect, it, vi } from 'vitest'
import { projectPath } from '../../src/lib/projectPaths'
import { openProject, pickProject } from '../../src/lib/desktop/projects'
import { createWorkspaceStore, useWorkspace } from '../../src/store/workspace'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  storage: new Map<string, string>(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }))
vi.mock('../../src/store/workspace', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/store/workspace')>()
  return {
    ...original,
    isDesktop: true,
    useWorkspace: original.createWorkspaceStore({
      getItem: (key) => mocks.storage.get(key) ?? null,
      setItem: (key, value) => {
        mocks.storage.set(key, value)
      },
      removeItem: (key) => {
        mocks.storage.delete(key)
      },
    }),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.storage.clear()
  useWorkspace.setState({
    projects: [],
    sessions: [],
    activeSessionId: null,
    runningSessionId: null,
    piUpdating: false,
    connection: 'disconnected',
    language: 'en',
  })
  mocks.invoke.mockImplementation(async (_command, { path }) => ({ path, branch: 'main' }))
})

describe('project paths', () => {
  it.each([
    [' /tmp/project/// ', '/tmp/project'],
    ['~/Projects/demo/', '~/Projects/demo'],
    ['/', '/'],
    ['~/', '~/'],
    ['C:\\', 'C:\\'],
    ['C:\\work\\demo\\', 'C:\\work\\demo'],
    ['\\\\server\\share\\', '\\\\server\\share'],
  ])('normalizes %s without damaging roots', (input, expected) => {
    expect(projectPath(input)).toBe(expected)
  })
  it.each(['', 'demo', '../demo', 'https://example.com/demo'])('rejects %s', (path) => {
    expect(projectPath(path)).toBeNull()
  })
})

describe('opening projects', () => {
  it('checks the directory before adding a project and its first chat', async () => {
    const id = await openProject(' ~/Projects/demo/ ')
    expect(mocks.invoke).toHaveBeenCalledWith('inspect_project', { path: '~/Projects/demo' })
    expect(useWorkspace.getState().projects).toEqual([
      expect.objectContaining({ id, path: '~/Projects/demo', branch: 'main' }),
    ])
    expect(useWorkspace.getState().sessions).toHaveLength(1)
    expect(useWorkspace.getState().sessions[0].projectId).toBe(id)
  })

  it('restores a hidden project and resumes its latest chat with its draft intact', async () => {
    const store = useWorkspace.getState()
    const id = store.addProject('/tmp/project')
    const old = store.createSession(id)
    store.updateSession(old, { updatedAt: 1 })
    const latest = store.createSession(id)
    store.updateSession(latest, { updatedAt: 2, draft: 'Unsent work' })
    store.removeProject(id)
    expect(await openProject('/tmp/project/')).toBe(id)
    expect(useWorkspace.getState().projects).toHaveLength(1)
    expect(useWorkspace.getState().projects[0].hidden).toBe(false)
    expect(useWorkspace.getState().sessions).toHaveLength(2)
    expect(useWorkspace.getState().activeSessionId).toBe(latest)
    expect(useWorkspace.getState().sessions.find((session) => session.id === latest)?.draft).toBe(
      'Unsent work',
    )

    const reloaded = createWorkspaceStore({
      getItem: (key) => mocks.storage.get(key) ?? null,
      setItem: () => {},
      removeItem: () => {},
    })
    expect(reloaded.getState().projects[0].hidden).toBe(false)
    expect(reloaded.getState().sessions).toHaveLength(2)
    expect(reloaded.getState().activeSessionId).toBe(latest)
  })

  it('uses the canonical path to avoid duplicate projects', async () => {
    const id = useWorkspace.getState().addProject('/Users/test/Projects/demo')
    const session = useWorkspace.getState().createSession(id)
    mocks.invoke.mockResolvedValue({ path: '/Users/test/Projects/demo', branch: 'main' })
    expect(await openProject('~/Projects/demo')).toBe(id)
    expect(useWorkspace.getState().projects).toHaveLength(1)
    expect(useWorkspace.getState().sessions).toHaveLength(1)
    expect(useWorkspace.getState().activeSessionId).toBe(session)
  })

  it('leaves the current project and draft intact when the directory cannot open', async () => {
    const id = useWorkspace.getState().addProject('/tmp/current')
    const session = useWorkspace.getState().createSession(id)
    useWorkspace.getState().updateSession(session, { draft: 'Keep this' })
    const before = useWorkspace.getState()
    mocks.invoke.mockRejectedValue(new Error('Folder does not exist'))
    await expect(openProject('/missing')).rejects.toThrow('Folder does not exist')
    expect(useWorkspace.getState()).toBe(before)
  })

  it('leaves the project unchanged when the system picker is canceled', async () => {
    mocks.open.mockResolvedValue(null)
    const before = useWorkspace.getState()
    expect(await pickProject()).toBeNull()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(useWorkspace.getState()).toBe(before)
  })

  it.each(['running', 'connecting', 'updating'])('blocks changes while %s', async (mode) => {
    useWorkspace.setState({
      runningSessionId: mode === 'running' ? 'busy' : null,
      connection: mode === 'connecting' ? 'connecting' : 'disconnected',
      piUpdating: mode === 'updating',
    })
    expect(await openProject('/tmp/demo')).toBeNull()
    expect(await pickProject()).toBeNull()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('rechecks locks after inspecting a folder', async () => {
    mocks.invoke.mockImplementation(async () => {
      useWorkspace.setState({ runningSessionId: 'busy' })
      return { path: '/tmp/demo', branch: null }
    })
    expect(await openProject('/tmp/demo')).toBeNull()
    expect(useWorkspace.getState().projects).toHaveLength(0)
    expect(useWorkspace.getState().sessions).toHaveLength(0)
  })
})
