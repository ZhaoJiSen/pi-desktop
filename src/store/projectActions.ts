import type { StoreApi } from 'zustand'
import { isRecentProject, RECENT_PROJECT_ID } from '../lib/recentProject'
import type { WorkspaceState } from './workspaceTypes'
export function projectActions(
  set: StoreApi<WorkspaceState>['setState'],
  get: StoreApi<WorkspaceState>['getState'],
): Pick<
  WorkspaceState,
  | 'toggleProject'
  | 'togglePinProject'
  | 'renameProject'
  | 'removeProject'
  | 'ensureRecentProject'
  | 'addProject'
> {
  return {
    toggleProject: (id) =>
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === id ? { ...project, collapsed: !project.collapsed } : project,
        ),
      })),
    togglePinProject: (id) => {
      if (isRecentProject(get().projects.find((project) => project.id === id))) return
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === id ? { ...project, pinned: !project.pinned } : project,
        ),
      }))
    },
    renameProject: (id, name) => {
      if (isRecentProject(get().projects.find((project) => project.id === id))) return
      const normalized = name.trim()
      if (!normalized) return
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === id ? { ...project, name: normalized } : project,
        ),
      }))
    },
    removeProject: (id) => {
      if (isRecentProject(get().projects.find((project) => project.id === id))) return
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === id ? { ...project, hidden: true, pinned: false } : project,
        ),
      }))
    },
    ensureRecentProject: (path) => {
      const state = get()
      const builtin = state.projects.find((project) => isRecentProject(project))
      const samePath = state.projects.find(
        (project) => project.path === path && project.id !== builtin?.id,
      )
      const asRecent = {
        builtin: 'recent' as const,
        hidden: false,
        pinned: false,
        branch: null,
        collapsed: false,
      }
      if (builtin && samePath) {
        set({
          projects: state.projects
            .filter((project) => project.id !== samePath.id)
            .map((project) =>
              project.id === builtin.id ? { ...project, ...asRecent, path } : project,
            ),
          sessions: state.sessions.map((session) =>
            session.projectId === samePath.id ? { ...session, projectId: builtin.id } : session,
          ),
        })
        return builtin.id
      }
      if (builtin) {
        set({
          projects: state.projects.map((project) =>
            project.id === builtin.id ? { ...project, ...asRecent, path } : project,
          ),
        })
        return builtin.id
      }
      if (samePath) {
        set({
          projects: state.projects.map((project) =>
            project.id === samePath.id ? { ...project, ...asRecent, path } : project,
          ),
        })
        return samePath.id
      }
      set({
        projects: [...state.projects, { id: RECENT_PROJECT_ID, name: 'Recent', path, ...asRecent }],
      })
      return RECENT_PROJECT_ID
    },
    addProject: (path, branch = null) => {
      const existing = get().projects.find((project) => project.path === path)
      if (existing) {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === existing.id
              ? {
                  ...project,
                  hidden: false,
                  collapsed: false,
                  ...(isRecentProject(project) ? { branch: null } : {}),
                }
              : project,
          ),
        }))
        return existing.id
      }
      const id = crypto.randomUUID()
      const name = path.split(/[\\/]/).filter(Boolean).at(-1) || path
      set((state) => ({
        projects: [...state.projects, { id, name, path, branch, collapsed: false }],
      }))
      return id
    },
  }
}
