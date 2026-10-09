import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspace } from '../../src/store/workspace'
import { createChat, navigateToPage, selectChat } from '../../src/router/navigation'

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('../../src/router', () => ({ router: { navigate: mocks.navigate } }))

beforeEach(() => {
  vi.clearAllMocks()
  useWorkspace.setState({
    projects: [],
    sessions: [],
    activeSessionId: null,
    connection: 'disconnected',
    runningSessionId: null,
  })
})

describe('session navigation', () => {
  it('opens a newly created chat through the router', () => {
    const project = useWorkspace.getState().addProject('/tmp/router-project')
    const id = createChat(project)
    expect(useWorkspace.getState().activeSessionId).toBe(id)
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' })
  })

  it('opens an existing chat and preserves its draft', () => {
    const store = useWorkspace.getState()
    const project = store.addProject('/tmp/router-project')
    const first = store.createSession(project)
    store.updateSession(first, { draft: 'Keep this draft' })
    store.createSession(project)
    expect(selectChat(first)).toBe(true)
    expect(useWorkspace.getState().activeSessionId).toBe(first)
    expect(useWorkspace.getState().sessions.find((session) => session.id === first)?.draft).toBe(
      'Keep this draft',
    )
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' })
  })

  it.each(['running', 'connecting'] as const)('refuses chat changes while %s', (status) => {
    const store = useWorkspace.getState()
    const project = store.addProject('/tmp/router-project')
    const first = store.createSession(project)
    const active = store.createSession(project)
    useWorkspace.setState(
      status === 'running' ? { runningSessionId: active } : { connection: 'connecting' },
    )
    expect(selectChat(first)).toBe(false)
    expect(createChat(project)).toBeNull()
    expect(useWorkspace.getState().activeSessionId).toBe(active)
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('does not navigate to a missing session', () => {
    expect(selectChat('missing')).toBe(false)
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('changes pages without changing the active session or drafts', () => {
    const store = useWorkspace.getState()
    const id = store.createSession(store.addProject('/tmp/router-project'))
    store.updateSession(id, { draft: 'Unsent message' })
    void navigateToPage('extensions')
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/extensions' })
    expect(useWorkspace.getState().activeSessionId).toBe(id)
    expect(useWorkspace.getState().sessions[0].draft).toBe('Unsent message')
  })
})
