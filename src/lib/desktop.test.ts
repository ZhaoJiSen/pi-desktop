import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), channels: [] as { onmessage: (event: unknown) => void }[] }))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  Channel: class { onmessage = vi.fn<(event: unknown) => void>(); constructor() { mocks.channels.push(this) } },
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('../store/workspace', async importOriginal => {
  const original = await importOriginal<typeof import('../store/workspace')>()
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  return { ...original, isDesktop: true, useWorkspace: original.createWorkspaceStore(storage) }
})

let useWorkspace: typeof import('../store/workspace').useWorkspace
let connectSession: typeof import('./desktop').connectSession
let removeSession: typeof import('./desktop').removeSession
let renameSession: typeof import('./desktop').renameSession
let sendPrompt: typeof import('./desktop').sendPrompt

const model = { id: 'test', name: 'Test model', provider: 'local', reasoning: true, contextWindow: 200000 }
function metadata(command: Record<string, unknown>) {
  switch (command.type) {
    case 'get_state': return { model, thinkingLevel: 'medium', sessionFile: '/tmp/session.jsonl', isStreaming: false }
    case 'get_available_models': return { models: [model] }
    case 'get_available_thinking_levels': return { levels: ['off', 'medium'] }
    case 'get_commands': return { commands: [] }
    case 'get_messages': return { messages: [] }
    case 'get_session_stats': return { tokens: { total: 0 }, cost: 0 }
    default: return {}
  }
}

describe('desktop prompt lifecycle', () => {
  let id: string
  beforeEach(async () => {
    vi.resetModules()
    ;({ useWorkspace } = await import('../store/workspace'))
    ;({ connectSession, removeSession, renameSession, sendPrompt } = await import('./desktop'))
    mocks.channels.length = 0
    mocks.invoke.mockReset()
    useWorkspace.setState({ projects: [], sessions: [], activeSessionId: null, runningSessionId: null, connection: 'disconnected', connectionAction: null })
    const store = useWorkspace.getState()
    id = store.createSession(store.addProject('/tmp/project'))
    mocks.invoke.mockImplementation(async (name, args) => name === 'pi_request' ? metadata(args.command) : name === 'extension_packages' ? [] : undefined)
    await connectSession(id, true)
    store.updateSession(id, { title: 'Existing session', draft: '请读取这个文件' })
  })

  it('keeps input and removes the optimistic message when pi rejects a prompt', async () => {
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name === 'pi_request' && args.command.type === 'prompt') throw new Error('Provider unavailable')
      return name === 'pi_request' ? metadata(args.command) : undefined
    })
    expect(await sendPrompt([])).toBe(false)
    expect(useWorkspace.getState().sessions[0]).toMatchObject({ draft: '请读取这个文件', messages: [] })
    expect(useWorkspace.getState()).toMatchObject({ runningSessionId: null, connectionError: 'Provider unavailable' })
  })

  it('renames a connected session through pi and retains its old title on RPC failure', async () => {
    await renameSession(id, '  Renamed  ')
    expect(useWorkspace.getState().sessions[0].title).toBe('Renamed')
    expect(mocks.invoke).toHaveBeenCalledWith('pi_request', expect.objectContaining({ command: expect.objectContaining({ type: 'set_session_name', name: 'Renamed' }) }))
    mocks.invoke.mockRejectedValueOnce(new Error('Rename failed'))
    await expect(renameSession(id, 'Lost title')).rejects.toThrow('Rename failed')
    expect(useWorkspace.getState().sessions[0].title).toBe('Renamed')
  })

  it('defers an inactive session name until its next connection without renaming the current pi session', async () => {
    const other = useWorkspace.getState().createSession(useWorkspace.getState().projects[0].id)
    useWorkspace.getState().selectSession(id)
    mocks.invoke.mockClear()
    await renameSession(other, 'Other session')
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(useWorkspace.getState().activeSessionId).toBe(id)
    expect(useWorkspace.getState().sessions.find(session => session.id === other)).toMatchObject({ title: 'Other session', pendingSessionName: 'Other session' })
    await connectSession(other)
    expect(mocks.invoke).toHaveBeenCalledWith('pi_request', expect.objectContaining({ command: expect.objectContaining({ type: 'set_session_name', name: 'Other session' }) }))
    expect(useWorkspace.getState().sessions.find(session => session.id === other)?.pendingSessionName).toBeUndefined()
  })

  it('creates and switches same-project sessions without restarting the process or reloading package sources', async () => {
    const store = useWorkspace.getState()
    const other = store.createSession(store.projects[0].id)
    mocks.invoke.mockClear()
    await connectSession(other)
    expect(mocks.invoke).toHaveBeenCalledWith('pi_request', expect.objectContaining({ command: expect.objectContaining({ type: 'new_session' }) }))
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi' || name === 'stop_pi' || name === 'extension_packages')).toHaveLength(0)
    mocks.invoke.mockClear()
    await connectSession(id)
    expect(mocks.invoke).toHaveBeenCalledWith('pi_request', expect.objectContaining({ command: expect.objectContaining({ type: 'switch_session', sessionPath: '/tmp/session.jsonl' }) }))
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi')).toHaveLength(0)
  })

  it('starts a second process for another project and replaces only that process on explicit reconnect', async () => {
    const store = useWorkspace.getState()
    const other = store.createSession(store.addProject('/tmp/other-project'))
    mocks.invoke.mockClear()
    await connectSession(other)
    expect(mocks.invoke).toHaveBeenCalledWith('start_pi', expect.objectContaining({ path: '/tmp/other-project' }))
    const otherRun = mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi').at(-1)![1].runId
    mocks.invoke.mockClear()
    await connectSession(other, true)
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi')).toHaveLength(1)
    expect(mocks.invoke).toHaveBeenCalledWith('stop_pi', { runId: otherRun })
    mocks.invoke.mockClear()
    await connectSession(id)
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi' || name === 'stop_pi')).toHaveLength(0)
  })

  it('restores model and thinking preferences after a reused session switch', async () => {
    const store = useWorkspace.getState()
    const other = store.createSession(store.projects[0].id)
    store.updateSession(other, { modelKey: 'local/alternate', thinking: 'off' })
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name !== 'pi_request') return undefined
      if (args.command.type === 'get_available_models') return { models: [model, { ...model, id: 'alternate' }] }
      return metadata(args.command)
    })
    await connectSession(other)
    expect(mocks.invoke).toHaveBeenCalledWith('pi_request', expect.objectContaining({ command: expect.objectContaining({ type: 'set_model', provider: 'local', modelId: 'alternate' }) }))
    expect(mocks.invoke).toHaveBeenCalledWith('pi_request', expect.objectContaining({ command: expect.objectContaining({ type: 'set_thinking_level', level: 'off' }) }))
  })

  it('keeps both projects connected when switching A → B → A → B and restores the correct history', async () => {
    const firstRun = mocks.invoke.mock.calls.find(([name]) => name === 'start_pi')![1].runId
    const projectByRun = new Map([[firstRun, '/tmp/project']])
    const store = useWorkspace.getState()
    const other = store.createSession(store.addProject('/tmp/project-two'))
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name === 'start_pi') { projectByRun.set(args.runId, args.path); return }
      if (name === 'extension_packages') return [{ source: args.path, scope: 'project' }]
      if (name !== 'pi_request') return undefined
      if (args.command.type === 'get_messages') return { messages: [{ role: 'user', content: [{ type: 'text', text: projectByRun.get(args.runId) }], timestamp: 1 }] }
      return metadata(args.command)
    })
    const actions: (string | null)[] = []
    const unsubscribe = useWorkspace.subscribe(state => actions.push(state.connectionAction))
    await connectSession(other)
    expect(actions).toContain('start')
    actions.length = 0
    await connectSession(id)
    await connectSession(other)
    unsubscribe()
    expect(actions).toContain('switch')
    expect(actions).not.toContain('start')
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi')).toHaveLength(2)
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'stop_pi')).toHaveLength(0)
    expect(mocks.invoke.mock.calls.filter(([name, args]) => name === 'pi_request' && ['new_session', 'switch_session'].includes(args.command.type))).toHaveLength(0)
    expect(useWorkspace.getState().sessions.find(session => session.id === id)?.messages[0].blocks[0]).toMatchObject({ text: '/tmp/project' })
    expect(useWorkspace.getState().sessions.find(session => session.id === other)?.messages[0].blocks[0]).toMatchObject({ text: '/tmp/project-two' })
    expect(useWorkspace.getState().packages[0].source).toBe('/tmp/project-two')
  })

  it('evicts an exited inactive project and reconnects only that project on its next visit', async () => {
    const firstRun = mocks.invoke.mock.calls.find(([name]) => name === 'start_pi')![1].runId
    const firstChannel = mocks.channels.at(-1)!
    const store = useWorkspace.getState()
    const other = store.createSession(store.addProject('/tmp/project-two'))
    await connectSession(other)
    firstChannel.onmessage({ runId: firstRun, event: { type: 'runtime_exit' } })
    expect(useWorkspace.getState()).toMatchObject({ connection: 'connected', connectionError: null })
    mocks.invoke.mockClear()
    await connectSession(id)
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi')).toHaveLength(1)
    await connectSession(other)
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi')).toHaveLength(1)
  })

  it('keeps the old session and process if an extension cancels switching', async () => {
    const store = useWorkspace.getState()
    const other = store.createSession(store.projects[0].id)
    mocks.invoke.mockClear()
    mocks.invoke.mockImplementation(async (name, args) => name === 'pi_request' && args.command.type === 'new_session' ? { cancelled: true } : metadata(args.command))
    await connectSession(other)
    expect(useWorkspace.getState()).toMatchObject({ activeSessionId: id, connection: 'connected', connectionError: 'pi 扩展取消了会话切换。' })
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi' || name === 'stop_pi')).toHaveLength(0)
    await renameSession(id, 'Still connected')
    expect(useWorkspace.getState().sessions.find(session => session.id === id)?.title).toBe('Still connected')
  })

  it('serializes concurrent switches and suppresses transition events from the old session', async () => {
    const store = useWorkspace.getState()
    const other = store.createSession(store.projects[0].id)
    const third = store.createSession(store.projects[0].id)
    const runId = mocks.invoke.mock.calls.find(([name]) => name === 'start_pi')![1].runId
    const channel = mocks.channels.at(-1)!
    let release!: (value: object) => void
    let switches = 0
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name === 'pi_request' && args.command.type === 'new_session' && ++switches === 1) return new Promise(resolve => { release = resolve })
      return name === 'pi_request' ? metadata(args.command) : undefined
    })
    const first = connectSession(other)
    const second = connectSession(third)
    channel.onmessage({ runId, event: { type: 'session_info_changed', name: 'Replacement event' } })
    expect(store.sessions.find(session => session.id === id)?.title).toBe('Existing session')
    expect(switches).toBe(1)
    release({ cancelled: false })
    await Promise.all([first, second])
    expect(switches).toBe(2)
    expect(useWorkspace.getState().connection).toBe('connected')
    expect(mocks.invoke.mock.calls.filter(([name]) => name === 'start_pi')).toHaveLength(1)
  })

  it('stops an active runtime before removal and ignores its late events', async () => {
    const runId = mocks.invoke.mock.calls.find(([name]) => name === 'start_pi')![1].runId
    const channel = mocks.channels.at(-1)!
    await removeSession(id)
    expect(mocks.invoke).toHaveBeenCalledWith('stop_pi', { runId })
    channel.onmessage({ runId, event: { type: 'runtime_exit' } })
    expect(useWorkspace.getState()).toMatchObject({ sessions: [], activeSessionId: null, connection: 'disconnected', connectionError: null })
  })

  it('keeps the session when stopping fails and rejects removal during generation', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('Stop failed'))
    await expect(removeSession(id)).rejects.toThrow('Stop failed')
    expect(useWorkspace.getState().sessions).toHaveLength(1)
    useWorkspace.setState({ runningSessionId: id })
    await expect(removeSession(id)).rejects.toThrow('请等待')
    await expect(renameSession(id, 'Busy')).rejects.toThrow('请等待')
  })

  it('retains an accepted message if the subsequent state refresh fails', async () => {
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name !== 'pi_request') return undefined
      if (args.command.type === 'prompt') return { disposition: 'handled' }
      throw new Error('Refresh failed')
    })
    expect(await sendPrompt([])).toBe(true)
    expect(useWorkspace.getState().sessions[0]).toMatchObject({ draft: '', messages: [{ role: 'user' }] })
    expect(useWorkspace.getState().connectionError).toBe('Refresh failed')
  })

  it('preserves newer typing during acknowledgement and holds the run lock until settled', async () => {
    let acknowledge!: (response: { disposition: string }) => void
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name === 'pi_request' && args.command.type === 'prompt') return new Promise(resolve => { acknowledge = resolve })
      return name === 'pi_request' ? metadata(args.command) : undefined
    })
    const sending = sendPrompt([])
    useWorkspace.getState().updateSession(id, { draft: '发送期间写下的新想法' })
    acknowledge({ disposition: 'submitted' })
    expect(await sending).toBe(true)
    expect(useWorkspace.getState().sessions[0].draft).toBe('发送期间写下的新想法')
    const call = mocks.invoke.mock.calls.find(([name]) => name === 'start_pi')!
    const runId = call[1].runId
    const channel = mocks.channels.at(-1)!
    channel.onmessage({ runId, event: { type: 'agent_end' } })
    expect(useWorkspace.getState().runningSessionId).toBe(id)
    channel.onmessage({ runId: 'old-run', event: { type: 'agent_settled' } })
    expect(useWorkspace.getState().runningSessionId).toBe(id)
    channel.onmessage({ runId, event: { type: 'agent_settled' } })
    expect(useWorkspace.getState().runningSessionId).toBeNull()
  })
})
