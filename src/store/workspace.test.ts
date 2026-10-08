import { describe, expect, it } from 'vitest'
import type { StateStorage } from 'zustand/middleware'
import { createWorkspaceStore } from './workspace'

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (name: string) => data.get(name) || null, setItem: (name: string, value: string) => { data.set(name, value) }, removeItem: (name: string) => { data.delete(name) } } satisfies StateStorage
}

describe('workspace persistence', () => {
  it('removes an inactive session without changing the active session and persists removal', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/project')
    const removed = store.getState().createSession(project)
    store.getState().updateSession(removed, { draft: 'discarded', attachments: [{ id: 'file', name: 'a.txt', kind: 'text', data: 'a', mimeType: 'text/plain' }] })
    const active = store.getState().createSession(project)
    expect(store.getState().removeSession(removed)).toBe(true)
    expect(store.getState().activeSessionId).toBe(active)
    expect(createWorkspaceStore(storage).getState().sessions.map(session => session.id)).toEqual([active])
  })

  it('selects the latest session in the same project, then another project, then empty state', () => {
    const store = createWorkspaceStore(memoryStorage())
    const first = store.getState().addProject('/tmp/first')
    const other = store.getState().createSession(store.getState().addProject('/tmp/other'))
    const older = store.getState().createSession(first)
    const newer = store.getState().createSession(first)
    const active = store.getState().createSession(first)
    store.getState().updateSession(older, { updatedAt: 1 })
    store.getState().updateSession(newer, { updatedAt: 2 })
    store.getState().updateSession(other, { updatedAt: 3 })
    store.getState().removeSession(active)
    expect(store.getState().activeSessionId).toBe(newer)
    store.getState().removeSession(newer)
    expect(store.getState().activeSessionId).toBe(older)
    store.getState().removeSession(older)
    expect(store.getState().activeSessionId).toBe(other)
    store.getState().removeSession(other)
    expect(store.getState()).toMatchObject({ activeSessionId: null, sessions: [], connection: 'disconnected' })
  })

  it('protects a running or connecting active session from removal', () => {
    const store = createWorkspaceStore(memoryStorage())
    const id = store.getState().createSession(store.getState().addProject('/tmp/project'))
    store.setState({ runningSessionId: id })
    expect(store.getState().removeSession(id)).toBe(false)
    store.setState({ runningSessionId: null, connection: 'connecting' })
    expect(store.getState().removeSession(id)).toBe(false)
    expect(store.getState().sessions).toHaveLength(1)
  })

  it('restores project, draft, attachment, selected model and preferences after reload', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/my-project', 'feature/ui')
    const session = store.getState().createSession(project)
    store.getState().updateSession(session, { draft: '还没有发送的想法', modelKey: 'anthropic/claude-sonnet', attachments: [{ id: 'file', name: 'notes.md', mimeType: 'text/plain', data: 'local notes', kind: 'text' }] })
    store.getState().setPreference({ theme: 'dark', language: 'en' })
    const restored = createWorkspaceStore(storage)
    expect(restored.getState()).toMatchObject({ activeSessionId: session, theme: 'dark', language: 'en', connection: 'disconnected', runningSessionId: null })
    expect(restored.getState().sessions[0]).toMatchObject({ draft: '还没有发送的想法', modelKey: 'anthropic/claude-sonnet', attachments: [{ name: 'notes.md', data: 'local notes' }] })
    expect(restored.getState().projects[0].branch).toBe('feature/ui')
  })

  it('keeps failed-to-save drafts in memory and reports a storage failure', async () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') }, removeItem: () => {} }
    const store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/project')
    const session = store.getState().createSession(project)
    store.getState().updateSession(session, { draft: '必须保留这个输入' })
    await Promise.resolve()
    expect(store.getState().sessions[0].draft).toBe('必须保留这个输入')
    expect(store.getState().storageError).toContain('本地保存失败')
  })

  it('locks session changes during a run and retains separate drafts per project', () => {
    const store = createWorkspaceStore(memoryStorage())
    const first = store.getState().createSession(store.getState().addProject('/tmp/first'))
    const second = store.getState().createSession(store.getState().addProject('/tmp/second'))
    store.getState().updateSession(first, { draft: 'first draft' })
    store.getState().updateSession(second, { draft: 'second draft' })
    store.setState({ runningSessionId: second })
    store.getState().selectSession(first)
    expect(store.getState().activeSessionId).toBe(second)
    store.setState({ runningSessionId: null })
    store.getState().selectSession(first)
    expect(store.getState().activeSessionId).toBe(first)
    expect(store.getState().sessions.find(session => session.id === second)?.draft).toBe('second draft')
  })

  it('does not persist process connection or replay running tool states after reload', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const id = store.getState().createSession(store.getState().addProject('/tmp/project'))
    store.getState().updateSession(id, { messages: [{ id: 'assistant', role: 'assistant', timestamp: 1, blocks: [{ type: 'tool', id: 'call', name: 'bash', label: 'pwd', args: {}, status: 'running', output: '' }] }] })
    store.setState({ runningSessionId: id, connection: 'connected' })
    const restored = createWorkspaceStore(storage)
    expect(restored.getState().runningSessionId).toBeNull()
    expect(restored.getState().connection).toBe('disconnected')
    expect(restored.getState().sessions[0].messages[0].blocks[0]).toMatchObject({ status: 'interrupted' })
  })
})
