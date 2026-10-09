import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StateStorage } from 'zustand/middleware'
import { createWorkspaceStore } from '../../src/store/workspace'
import { createCommandTag } from '../../src/lib/draft'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (name: string) => data.get(name) || null,
    setItem: (name: string, value: string) => {
      data.set(name, value)
    },
    removeItem: (name: string) => {
      data.delete(name)
    },
  } satisfies StateStorage
}

describe('workspace persistence', () => {
  it('shows setup for new installations and persists completion independently of projects', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    expect(store.getState()).toMatchObject({
      onboardingCompleted: false,
      onboardingOpen: true,
      projects: [],
      sessions: [],
    })
    store.getState().closeOnboarding()
    expect(store.getState().onboardingOpen).toBe(true)
    store.getState().completeOnboarding()
    const reopened = createWorkspaceStore(storage)
    expect(reopened.getState()).toMatchObject({
      onboardingCompleted: true,
      onboardingOpen: false,
      sessions: [],
    })
    reopened.getState().openOnboarding()
    expect(reopened.getState().onboardingOpen).toBe(true)
    expect(createWorkspaceStore(storage).getState().onboardingOpen).toBe(false)
    reopened.getState().closeOnboarding()
    expect(reopened.getState().onboardingOpen).toBe(false)
  })
  it('does not interrupt existing installations with setup after an upgrade', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const session = store.getState().createSession(store.getState().addProject('/tmp/legacy'))
    const raw = JSON.parse(storage.getItem('pi-desktop-workspace-v1')!)
    delete raw.state.onboardingCompleted
    storage.setItem('pi-desktop-workspace-v1', JSON.stringify(raw))
    const upgraded = createWorkspaceStore(storage)
    expect(upgraded.getState()).toMatchObject({
      onboardingCompleted: true,
      onboardingOpen: false,
      activeSessionId: session,
    })
  })
  it('retains completion in memory and reports a failed persistence write', async () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    storage.setItem = () => {
      throw new Error('disk full')
    }
    store.getState().completeOnboarding()
    await Promise.resolve()
    expect(store.getState()).toMatchObject({ onboardingCompleted: true, onboardingOpen: false })
    expect(store.getState().storageError).not.toBeNull()
    expect(createWorkspaceStore(storage).getState().onboardingOpen).toBe(true)
  })
  it('restores mixed command drafts across sessions and restarts, and plain-text updates replace tags', () => {
    const storage = memoryStorage(),
      store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/project')
    const first = store.getState().createSession(project)
    const nodes = [
      createCommandTag({
        name: 'review',
        source: 'extension',
        sourceInfo: { source: 'npm:review' },
      }),
      { type: 'text' as const, text: ' inspect' },
      createCommandTag({ name: 'skill:check', source: 'skill' }),
    ]
    store.getState().updateSession(first, { draftNodes: nodes })
    const second = store.getState().createSession(project)
    store.getState().updateSession(second, { draft: 'another draft' })
    store.getState().selectSession(first)
    const reopened = createWorkspaceStore(storage)
    expect(reopened.getState().sessions.find((s) => s.id === first)?.draftNodes).toEqual(nodes)
    expect(reopened.getState().sessions.find((s) => s.id === second)?.draft).toBe('another draft')
    expect(reopened.getState().activeSessionId).toBe(first)
    reopened.getState().updateSession(first, { draft: 'extension editor replacement' })
    expect(reopened.getState().sessions.find((s) => s.id === first)?.draftNodes).toBeUndefined()
  })
  it('keeps structured drafts in memory when local saving fails', async () => {
    const storage = memoryStorage(),
      store = createWorkspaceStore(storage)
    const id = store.getState().createSession(store.getState().addProject('/tmp/project'))
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    const nodes = [createCommandTag({ name: 'review', source: 'extension' })]
    store.getState().updateSession(id, { draftNodes: nodes })
    await Promise.resolve()
    expect(store.getState().sessions.find((s) => s.id === id)?.draftNodes).toEqual(nodes)
    expect(store.getState().storageError).not.toBeNull()
  })
  it('restores renamed projects and preserves names, paths and conversations when reopening a folder', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/project', 'main')
    const session = store.getState().createSession(project)
    store.getState().updateSession(session, { draft: '保留草稿' })
    store.getState().togglePinProject(project)
    store.getState().renameProject(project, '  My workspace  ')
    store.getState().renameProject(project, '   ')
    const restored = createWorkspaceStore(storage)
    expect(restored.getState().projects[0]).toMatchObject({
      id: project,
      name: 'My workspace',
      path: '/tmp/project',
      branch: 'main',
      pinned: true,
    })
    expect(restored.getState().activeSessionId).toBe(session)
    expect(restored.getState().sessions[0]).toMatchObject({
      id: session,
      projectId: project,
      draft: '保留草稿',
    })
    restored.getState().removeProject(project)
    expect(restored.getState().addProject('/tmp/project')).toBe(project)
    expect(restored.getState().projects).toHaveLength(1)
    expect(restored.getState().projects[0].name).toBe('My workspace')
    expect(createWorkspaceStore(storage).getState().projects[0].name).toBe('My workspace')
  })

  it('persists session pins without changing the active conversation, draft or update time', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/project')
    const pinned = store.getState().createSession(project)
    store.getState().updateSession(pinned, { draft: '未发送的内容', updatedAt: 123 })
    const active = store.getState().createSession(project)
    store.getState().togglePinSession(pinned)
    const restored = createWorkspaceStore(storage)
    expect(restored.getState().activeSessionId).toBe(active)
    expect(restored.getState().sessions.find((session) => session.id === pinned)).toMatchObject({
      pinned: true,
      draft: '未发送的内容',
      updatedAt: 123,
    })
    restored.getState().togglePinSession(pinned)
    expect(
      createWorkspaceStore(storage)
        .getState()
        .sessions.find((session) => session.id === pinned)?.pinned,
    ).toBe(false)
  })

  it('reports a failed session pin save while retaining the conversation in memory', async () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    store.getState().setPreference({ language: 'en' })
    const session = store.getState().createSession(store.getState().addProject('/tmp/project'))
    store.getState().updateSession(session, { draft: '保留草稿' })
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    store.getState().togglePinSession(session)
    await Promise.resolve()
    expect(store.getState().storageError).toContain('Could not save locally')
    expect(store.getState().sessions[0]).toMatchObject({ pinned: true, draft: '保留草稿' })
    expect(createWorkspaceStore(storage).getState().sessions[0].pinned).not.toBe(true)
  })

  it('persists project pins and keeps conversations and drafts when removing and reopening a project', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/project')
    const session = store.getState().createSession(project)
    store.getState().updateSession(session, { draft: '保留的草稿' })
    store.getState().togglePinProject(project)
    expect(createWorkspaceStore(storage).getState().projects[0].pinned).toBe(true)
    store.getState().removeProject(project)
    const restored = createWorkspaceStore(storage)
    expect(restored.getState().projects[0]).toMatchObject({ hidden: true, pinned: false })
    expect(restored.getState().sessions[0]).toMatchObject({ id: session, draft: '保留的草稿' })
    expect(restored.getState().activeSessionId).toBe(session)
    expect(restored.getState().addProject('/tmp/project')).toBe(project)
    expect(restored.getState().projects).toHaveLength(1)
    expect(restored.getState().projects[0].hidden).toBe(false)
  })

  it('restores a hidden project through a conversation without bypassing the run lock', () => {
    const store = createWorkspaceStore(memoryStorage())
    const project = store.getState().addProject('/tmp/project')
    const session = store.getState().createSession(project)
    store.getState().removeProject(project)
    store.setState({ runningSessionId: session })
    store.getState().selectSession(session)
    expect(store.getState().projects[0].hidden).toBe(true)
    store.setState({ runningSessionId: null })
    store.getState().selectSession(session)
    expect(store.getState().projects[0].hidden).toBe(false)
  })

  it('reports a failed pin save and retains project data in memory', async () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    store.getState().setPreference({ language: 'en' })
    const project = store.getState().addProject('/tmp/project')
    const session = store.getState().createSession(project)
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    store.getState().togglePinProject(project)
    await Promise.resolve()
    expect(store.getState().storageError).toContain('Could not save locally')
    expect(store.getState().projects[0].pinned).toBe(true)
    expect(store.getState().activeSessionId).toBe(session)
    expect(createWorkspaceStore(storage).getState().projects[0].pinned).not.toBe(true)
  })
  it('removes an inactive session without changing the active session and persists removal', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/project')
    const removed = store.getState().createSession(project)
    store.getState().updateSession(removed, {
      draft: 'discarded',
      attachments: [{ id: 'file', name: 'a.txt', kind: 'text', data: 'a', mimeType: 'text/plain' }],
    })
    const active = store.getState().createSession(project)
    expect(store.getState().removeSession(removed)).toBe(true)
    expect(store.getState().activeSessionId).toBe(active)
    expect(
      createWorkspaceStore(storage)
        .getState()
        .sessions.map((session) => session.id),
    ).toEqual([active])
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
    expect(store.getState()).toMatchObject({
      activeSessionId: null,
      sessions: [],
      connection: 'disconnected',
    })
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
    store.getState().updateSession(session, {
      draft: '还没有发送的想法',
      modelKey: 'anthropic/claude-sonnet',
      attachments: [
        {
          id: 'file',
          name: 'notes.md',
          mimeType: 'text/plain',
          data: 'local notes',
          kind: 'text',
        },
      ],
    })
    store.getState().setPreference({ theme: 'dark', language: 'en' })
    const restored = createWorkspaceStore(storage)
    expect(restored.getState()).toMatchObject({
      activeSessionId: session,
      theme: 'dark',
      language: 'en',
      connection: 'disconnected',
      runningSessionId: null,
    })
    expect(restored.getState().sessions[0]).toMatchObject({
      draft: '还没有发送的想法',
      modelKey: 'anthropic/claude-sonnet',
      attachments: [{ name: 'notes.md', data: 'local notes' }],
    })
    expect(restored.getState().projects[0].branch).toBe('feature/ui')
  })

  it('keeps failed-to-save drafts in memory and reports a storage failure', async () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    const store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/project')
    const session = store.getState().createSession(project)
    store.getState().updateSession(session, { draft: '必须保留这个输入' })
    await Promise.resolve()
    expect(store.getState().sessions[0].draft).toBe('必须保留这个输入')
    expect(store.getState().storageError).toContain('Could not save locally')
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
    expect(store.getState().sessions.find((session) => session.id === second)?.draft).toBe(
      'second draft',
    )
  })

  it('does not persist process connection or replay running tool states after reload', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const id = store.getState().createSession(store.getState().addProject('/tmp/project'))
    store.getState().updateSession(id, {
      messages: [
        {
          id: 'assistant',
          role: 'assistant',
          timestamp: 1,
          blocks: [
            {
              type: 'tool',
              id: 'call',
              name: 'bash',
              label: 'pwd',
              args: {},
              status: 'running',
              output: '',
            },
          ],
        },
      ],
    })
    store.setState({ runningSessionId: id, connection: 'connected' })
    const restored = createWorkspaceStore(storage)
    expect(restored.getState().runningSessionId).toBeNull()
    expect(restored.getState().connection).toBe('disconnected')
    expect(restored.getState().sessions[0].messages[0].blocks[0]).toMatchObject({
      status: 'interrupted',
    })
  })
})

describe('language preferences', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses only the browser preferred language before the native locale arrives', () => {
    vi.stubGlobal('navigator', { language: 'ja-JP', languages: ['ja-JP', 'zh-CN'] })
    const store = createWorkspaceStore(memoryStorage())
    expect(store.getState()).toMatchObject({ language: 'en', languageSource: 'system' })
    store.getState().applySystemLocale('zh-Hant-TW')
    expect(store.getState().language).toBe('zh')
  })

  it('rechecks the system language after reload rather than freezing the first default', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    store.getState().applySystemLocale('zh-CN')
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    const restored = createWorkspaceStore(storage)
    expect(restored.getState()).toMatchObject({ language: 'en', languageSource: 'system' })
    restored.getState().applySystemLocale('de-DE')
    expect(restored.getState().language).toBe('en')
  })

  it('retains an explicit language preference across reload and system changes', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    store.getState().setPreference({ language: 'zh' })
    store.getState().applySystemLocale('en-US')
    const restored = createWorkspaceStore(storage)
    restored.getState().applySystemLocale('ja-JP')
    expect(restored.getState()).toMatchObject({ language: 'zh', languageSource: 'user' })
  })

  it('preserves legacy saved language settings and rejects unsupported saved languages', () => {
    const storage = memoryStorage()
    storage.setItem(
      'pi-desktop-workspace-v1',
      JSON.stringify({ version: 1, state: { language: 'zh' } }),
    )
    expect(createWorkspaceStore(storage).getState()).toMatchObject({
      language: 'zh',
      languageSource: 'user',
    })
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    storage.setItem(
      'pi-desktop-workspace-v1',
      JSON.stringify({ version: 1, state: { language: 'fr' } }),
    )
    expect(createWorkspaceStore(storage).getState()).toMatchObject({
      language: 'en',
      languageSource: 'system',
    })
  })
})

describe('language-independent session titles', () => {
  it('stores new conversations without localized placeholder text', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const id = store.getState().createSession(store.getState().addProject('/tmp/project'))
    expect(store.getState().sessions[0]).toMatchObject({ id, title: '' })
    store.getState().setPreference({ language: 'en' })
    const restored = createWorkspaceStore(storage)
    expect(restored.getState().sessions[0].title).toBe('')
    // A title entered by the user must remain literal, even if it matches a UI label.
    restored.getState().updateSession(id, { title: '新聊天' })
    expect(createWorkspaceStore(storage).getState().sessions[0].title).toBe('新聊天')
  })

  it('migrates the v1 default title without changing custom titles or preferences', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(storage)
    const project = store.getState().addProject('/tmp/project')
    const custom = store.getState().createSession(project)
    store.getState().updateSession(custom, { title: '用户自己的标题' })
    const initial = store.getState().createSession(project)
    store.getState().setPreference({ language: 'en' })
    const saved = JSON.parse(storage.getItem('pi-desktop-workspace-v1')!)
    saved.version = 1
    saved.state.sessions.find((session: { id: string }) => session.id === initial).title = '新聊天'
    storage.setItem('pi-desktop-workspace-v1', JSON.stringify(saved))
    const restored = createWorkspaceStore(storage)
    expect(restored.getState().sessions.find((session) => session.id === initial)?.title).toBe('')
    expect(restored.getState().sessions.find((session) => session.id === custom)?.title).toBe(
      '用户自己的标题',
    )
    expect(restored.getState().language).toBe('en')
    expect(JSON.parse(storage.getItem('pi-desktop-workspace-v1')!).version).toBe(2)
  })
})
