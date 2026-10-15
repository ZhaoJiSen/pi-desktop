import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), activate: vi.fn(), warm: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  Channel: class {
    onmessage: (message: unknown) => void = () => {}
  },
}))
vi.mock('../../src/lib/desktop/connections', () => ({
  activateSession: mocks.activate,
  warmProject: mocks.warm,
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
let updates: typeof import('../../src/lib/piUpdates')
let workspace: typeof import('../../src/store/workspace').useWorkspace
let runtime: typeof import('../../src/lib/desktop/runtimeState').runtimeState
let first: string, second: string
const offer = {
  executable: '/bin/pi',
  currentVersion: '1.0.0',
  latestVersion: '1.2.0',
  hasUpdate: true,
}
const upgraded = {
  executable: '/bin/pi',
  version: '1.2.0',
  nodeVersion: null,
  defaultWorkspace: '/home/Pi Desktop',
}
const live = [
  { id: 'run-one', path: '/project-one', executable: '/bin/pi' },
  { id: 'run-two', path: '/project-two', executable: '/bin/pi' },
]

beforeEach(async () => {
  vi.resetModules()
  for (const mock of Object.values(mocks)) mock.mockReset()
  updates = await import('../../src/lib/piUpdates')
  workspace = (await import('../../src/store/workspace')).useWorkspace
  runtime = (await import('../../src/lib/desktop/runtimeState')).runtimeState
  workspace.setState({
    language: 'en',
    piExecutable: '/bin/pi',
    piUpdating: false,
    piBusyRuns: [],
    projects: [],
    sessions: [],
    connection: 'connected',
    storageError: null,
  })
  first = workspace.getState().createSession(workspace.getState().addProject('/project-one'))
  second = workspace.getState().createSession(workspace.getState().addProject('/project-two'))
  workspace.setState({ activeSessionId: first, connection: 'connected' })
  workspace.getState().updateSession(first, {
    draft: 'keep this draft',
    draftNodes: [{ type: 'text', text: 'keep this draft' }],
  })
  for (const [index, run] of live.entries())
    runtime.projectConnections.set(run.path, {
      ...run,
      sessionId: index ? second : first,
      bindingVersion: 0,
      packages: [],
    })
  runtime.currentRun = runtime.projectConnections.get(live[0].path)!
  mocks.activate.mockImplementation(async () => {
    workspace.setState({ connection: 'connected' })
  })
  mocks.warm.mockResolvedValue(undefined)
  mocks.invoke.mockImplementation(async (name, args) => {
    if (name === 'check_pi_update') return offer
    if (name === 'pi_connections') return live
    if (name === 'pi_request') {
      if (args.command.type === 'get_state')
        return {
          isStreaming: false,
          thinkingLevel: 'medium',
          sessionFile: `/sessions/${args.runId}.jsonl`,
        }
      if (args.command.type === 'get_messages')
        return { messages: [{ role: 'user', content: 'saved conversation', timestamp: 1 }] }
      return { tokens: { total: 10 }, cost: 0 }
    }
    if (name === 'upgrade_pi') {
      args.onProgress.onmessage({ stage: 'stopping' })
      return upgraded
    }
    return undefined
  })
})

describe('Pi update orchestration', () => {
  it('deduplicates background checks and trims the configured executable', async () => {
    const a = updates.checkPiUpdate(' /bin/pi ')
    const b = updates.checkPiUpdate('/bin/pi')
    expect(a).toBe(b)
    expect(await a).toEqual(offer)
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('check_pi_update', {
      executable: '/bin/pi',
    })
  })
  it('allows a failed background request to be retried', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('offline'))
    await expect(updates.checkPiUpdate('/bin/pi')).rejects.toThrow('offline')
    await expect(updates.checkPiUpdate('/bin/pi')).resolves.toEqual(offer)
  })
  it('saves both projects, restores their exact sessions and the active project, and keeps drafts', async () => {
    const phase = vi.fn()
    await expect(updates.upgradePi('/bin/pi', phase)).resolves.toEqual(upgraded)
    expect(mocks.invoke).toHaveBeenCalledWith(
      'upgrade_pi',
      expect.objectContaining({
        executable: '/bin/pi',
        sessions: [
          { runId: 'run-one', sessionFile: '/sessions/run-one.jsonl' },
          { runId: 'run-two', sessionFile: '/sessions/run-two.jsonl' },
        ],
      }),
    )
    expect(mocks.activate.mock.calls).toEqual([
      [first, true, true],
      [second, true, true],
      [first, false, true],
    ])
    const session = workspace.getState().sessions.find((item) => item.id === first)!
    expect(session).toMatchObject({
      draft: 'keep this draft',
      draftNodes: [{ type: 'text', text: 'keep this draft' }],
      piSessionFile: '/sessions/run-one.jsonl',
    })
    expect(session.messages[0].blocks).toEqual([{ type: 'text', text: 'saved conversation' }])
    expect(phase.mock.calls).toEqual([['updating'], ['reconnecting']])
    expect(workspace.getState()).toMatchObject({
      activeSessionId: first,
      piUpdating: false,
      connection: 'connected',
    })
  })
  it('recovers the original connections after an update command fails', async () => {
    const invoke = mocks.invoke.getMockImplementation()!
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name === 'upgrade_pi') {
        args.onProgress.onmessage({ stage: 'stopping' })
        throw new Error('unsupported installation')
      }
      return invoke(name, args)
    })
    await expect(updates.upgradePi('/bin/pi', vi.fn())).rejects.toThrow('unsupported installation')
    expect(mocks.activate).toHaveBeenCalledTimes(3)
    expect(workspace.getState().piUpdating).toBe(false)
    expect(workspace.getState().sessions.find((item) => item.id === first)?.draft).toBe(
      'keep this draft',
    )
  })
  it.each([false, true])(
    'restores the selected session whose process had exited (update fails: %s)',
    async (updateFails) => {
      workspace.setState({ activeSessionId: second, connection: 'disconnected' })
      workspace.getState().updateSession(second, { draft: 'keep the selected draft' })
      runtime.projectConnections.delete(live[1].path)
      runtime.currentRun = null
      const invoke = mocks.invoke.getMockImplementation()!
      mocks.invoke.mockImplementation(async (name, args) => {
        if (name === 'pi_connections') return [live[0]]
        if (name === 'upgrade_pi' && updateFails) {
          args.onProgress.onmessage({ stage: 'stopping' })
          throw new Error('unsupported installation')
        }
        return invoke(name, args)
      })
      mocks.activate.mockImplementation(async (sessionId: string) => {
        const session = workspace.getState().sessions.find((item) => item.id === sessionId)!
        const project = workspace.getState().projects.find((item) => item.id === session.projectId)!
        const run = {
          id: `restored-${sessionId}`,
          path: project.path,
          executable: '/bin/pi',
          sessionId,
          bindingVersion: 0,
          packages: [],
        }
        runtime.projectConnections.set(project.path, run)
        runtime.currentRun = run
        workspace.setState({ connection: 'connected' })
      })

      const result = updates.upgradePi('/bin/pi', vi.fn())
      if (updateFails) await expect(result).rejects.toThrow('unsupported installation')
      else await expect(result).resolves.toEqual(upgraded)

      expect(mocks.activate.mock.calls).toEqual([
        [first, true, true],
        [second, false, true],
      ])
      expect(runtime.currentRun).toMatchObject({ sessionId: second })
      expect(workspace.getState()).toMatchObject({
        activeSessionId: second,
        connection: 'connected',
        piUpdating: false,
      })
      expect(workspace.getState().sessions.find((item) => item.id === second)?.draft).toBe(
        'keep the selected draft',
      )
    },
  )
  it('keeps recovery failures actionable and releases the upgrade lock', async () => {
    mocks.activate.mockImplementation(async () => {
      workspace.setState({ connection: 'error', connectionError: 'executable missing' })
    })
    await expect(updates.upgradePi('/bin/pi', vi.fn())).rejects.toThrow('Pi could not reconnect')
    expect(workspace.getState()).toMatchObject({ piUpdating: false, connection: 'error' })
  })
  it('can retry the original project connections after installation succeeded without installing again', async () => {
    mocks.activate.mockImplementation(async () => {
      workspace.setState({ connection: 'error', connectionError: 'connection failed' })
    })
    const error = await updates.upgradePi('/bin/pi', vi.fn()).catch((reason) => reason)
    expect(error).toBeInstanceOf(updates.PiReconnectError)
    mocks.activate.mockImplementation(async () => {
      workspace.setState({ connection: 'connected' })
    })
    mocks.invoke.mockClear()
    mocks.activate.mockClear()
    await expect(error.retryConnection(vi.fn())).resolves.toEqual(upgraded)
    expect(mocks.activate.mock.calls).toEqual([
      [first, true, true],
      [second, true, true],
      [first, false, true],
    ])
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(workspace.getState().piUpdating).toBe(false)
  })
  it('refuses busy, simultaneous, or unsaved upgrades before changing an installation', async () => {
    for (const patch of [
      { runningSessionId: first },
      { piBusyRuns: ['run-two'] },
      { piUpdating: true },
      { connection: 'connecting' as const },
    ]) {
      workspace.setState({
        runningSessionId: null,
        piBusyRuns: [],
        piUpdating: false,
        connection: 'connected',
        ...patch,
      })
      await expect(updates.upgradePi('/bin/pi', vi.fn())).rejects.toThrow('busy')
    }
    expect(mocks.invoke).not.toHaveBeenCalled()
    workspace.setState({ piUpdating: false, connection: 'connected', storageError: 'disk full' })
    await expect(updates.upgradePi('/bin/pi', vi.fn())).rejects.toThrow('could not be saved')
    expect(mocks.invoke.mock.calls.some(([name]) => name === 'upgrade_pi')).toBe(false)
  })
  it('does not stop or reconnect runs when the native preflight rejects the update', async () => {
    const invoke = mocks.invoke.getMockImplementation()!
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name === 'upgrade_pi') throw new Error('session changed')
      return invoke(name, args)
    })
    await expect(updates.upgradePi('/bin/pi', vi.fn())).rejects.toThrow('session changed')
    expect(mocks.activate).not.toHaveBeenCalled()
    expect(runtime.projectConnections.size).toBe(2)
    expect(workspace.getState().piUpdating).toBe(false)
  })
  it('refuses a native background task even if the selected project is idle', async () => {
    const invoke = mocks.invoke.getMockImplementation()!
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name === 'pi_request' && args.runId === 'run-two' && args.command.type === 'get_state')
        return { isStreaming: true }
      return invoke(name, args)
    })
    await expect(updates.upgradePi('/bin/pi', vi.fn())).rejects.toThrow('busy')
    expect(mocks.invoke.mock.calls.some(([name]) => name === 'upgrade_pi')).toBe(false)
  })
  it('does not update when a populated conversation has no recoverable session file', async () => {
    const invoke = mocks.invoke.getMockImplementation()!
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name === 'pi_request' && args.command.type === 'get_state') return { isStreaming: false }
      return invoke(name, args)
    })
    await expect(updates.upgradePi('/bin/pi', vi.fn())).rejects.toThrow('could not be saved')
    expect(mocks.invoke.mock.calls.some(([name]) => name === 'upgrade_pi')).toBe(false)
  })
})
