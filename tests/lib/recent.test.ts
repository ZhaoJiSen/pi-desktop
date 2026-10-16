import { describe, expect, it } from 'vitest'
import { folderForNewChat, isRecentProject, RECENT_PROJECT_ID } from '../../src/lib/recentProject'
import type { Project } from '../../src/types'

const folder = (id: string): Project => ({
  id,
  name: id,
  path: `/tmp/${id}`,
  branch: null,
  collapsed: false,
})

describe('new chat destination', () => {
  it('opens Recent when nothing is selected', () => {
    expect(folderForNewChat({ activeSessionId: null, sessions: [], projects: [] })).toBeNull()
  })

  it('opens Recent when the current conversation already belongs there', () => {
    const recent = {
      ...folder(RECENT_PROJECT_ID),
      builtin: 'recent' as const,
      path: '/home/Pi Desktop',
    }
    expect(
      folderForNewChat({
        activeSessionId: 'chat',
        sessions: [{ id: 'chat', projectId: recent.id }],
        projects: [recent, folder('app')],
      }),
    ).toBeNull()
    expect(isRecentProject(recent)).toBe(true)
  })

  it('stays in the current folder', () => {
    expect(
      folderForNewChat({
        activeSessionId: 'chat',
        sessions: [{ id: 'chat', projectId: 'app' }],
        projects: [folder('app')],
      }),
    ).toBe('app')
  })
})
