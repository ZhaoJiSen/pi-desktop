import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkspacePersistence } from '../../src/store/persistence'
import { createWorkspaceStore } from '../../src/store/workspace'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('stream checkpoints', () => {
  it('defers serialization itself, saves the latest snapshot, and checkpoints a continuous stream', () => {
    vi.useFakeTimers()
    const setItem = vi.fn()
    const persistence = createWorkspacePersistence<{ text: string }>(
      { getItem: () => null, removeItem: () => {}, setItem },
      () => true,
    )
    const stringify = vi.spyOn(JSON, 'stringify')
    for (let i = 0; i < 100; i++)
      persistence.storage.setItem('workspace', { version: 3, state: { text: String(i) } })
    expect(stringify).not.toHaveBeenCalled()
    vi.advanceTimersByTime(499)
    expect(setItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(stringify).toHaveBeenCalledOnce()
    expect(JSON.parse(setItem.mock.calls[0][1]).state.text).toBe('99')
    persistence.storage.setItem('workspace', { version: 3, state: { text: 'next' } })
    vi.advanceTimersByTime(500)
    expect(setItem).toHaveBeenCalledTimes(2)
  })

  it('flushes immediately on explicit save and suppresses unchanged transient state writes', () => {
    vi.useFakeTimers()
    let defer = true
    const setItem = vi.fn()
    const persistence = createWorkspacePersistence<{ text: string }>(
      { getItem: () => null, removeItem: () => {}, setItem },
      () => defer,
    )
    persistence.storage.setItem('workspace', { version: 3, state: { text: 'pending' } })
    persistence.flush()
    expect(setItem).toHaveBeenCalledOnce()
    defer = false
    persistence.storage.setItem('workspace', { version: 3, state: { text: 'pending' } })
    expect(setItem).toHaveBeenCalledOnce()
    persistence.storage.setItem('workspace', { version: 3, state: { text: 'saved' } })
    vi.runAllTimers()
    expect(setItem).toHaveBeenCalledTimes(2)
    expect(JSON.parse(setItem.mock.calls[1][1]).state.text).toBe('saved')
  })

  it('does not resurrect a workspace cleared during a pending checkpoint', () => {
    vi.useFakeTimers()
    const setItem = vi.fn(),
      removeItem = vi.fn()
    const persistence = createWorkspacePersistence<{ text: string }>(
      { getItem: () => null, removeItem, setItem },
      () => true,
    )
    persistence.storage.setItem('workspace', { state: { text: 'pending' } })
    persistence.storage.removeItem('workspace')
    vi.runAllTimers()
    persistence.flush()
    expect(removeItem).toHaveBeenCalledWith('workspace')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('restores every token after completion, including authoritative message corrections', () => {
    vi.useFakeTimers()
    const data = new Map<string, string>()
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      removeItem: (key: string) => {
        data.delete(key)
      },
      setItem: (key: string, value: string) => {
        data.set(key, value)
      },
    }
    const store = createWorkspaceStore(storage)
    const id = store.getState().createSession('project')
    store.setState({ runningSessionId: id })
    store
      .getState()
      .appendEvent(id, { type: 'message_start', message: { role: 'assistant', content: [] } })
    store
      .getState()
      .appendEvent(id, {
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'draft' },
      })
    store.setState({ runningSessionId: null })
    expect(
      createWorkspaceStore(storage).getState().sessions[0].messages[0].blocks[0],
    ).toMatchObject({ text: 'draft' })
    store
      .getState()
      .appendEvent(id, {
        type: 'message_end',
        message: { role: 'assistant', content: [{ type: 'text', text: '最终结果' }] },
      })
    expect(
      createWorkspaceStore(storage).getState().sessions[0].messages[0].blocks[0],
    ).toMatchObject({ text: '最终结果' })
    vi.runAllTimers()
    expect(
      createWorkspaceStore(storage).getState().sessions[0].messages[0].blocks[0],
    ).toMatchObject({ text: '最终结果' })
  })

  it('reports a failed deferred write and retains all content in memory', async () => {
    vi.useFakeTimers()
    let failed = false
    const store = createWorkspaceStore({
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        if (failed) throw new Error('disk full')
      },
    })
    const id = store.getState().createSession('project')
    store
      .getState()
      .appendEvent(id, { type: 'message_start', message: { role: 'assistant', content: [] } })
    store
      .getState()
      .appendEvent(id, {
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: '保留内容' },
      })
    failed = true
    await vi.advanceTimersByTimeAsync(500)
    expect(store.getState().storageError).not.toBeNull()
    expect(store.getState().sessions[0].messages[0].blocks[0]).toMatchObject({ text: '保留内容' })
  })
})
