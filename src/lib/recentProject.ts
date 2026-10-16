import type { Project } from '../types'

export const RECENT_PROJECT_ID = 'recent'

export function isRecentProject(
  project: Pick<Project, 'id' | 'builtin'> | null | undefined,
): boolean {
  return project?.builtin === 'recent' || project?.id === RECENT_PROJECT_ID
}

// A new chat stays in the current folder. With no folder, or with Recent
// already current, the caller opens Recent instead of asking for a directory.
export function folderForNewChat(state: {
  activeSessionId: string | null
  sessions: { id: string; projectId: string }[]
  projects: Project[]
}): string | null {
  const current = state.sessions.find((session) => session.id === state.activeSessionId)
  const project = state.projects.find((item) => item.id === current?.projectId)
  if (project && !isRecentProject(project)) return project.id
  return null
}
