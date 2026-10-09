import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type {
  ExtensionPackage,
  Model,
  PiEvent,
  Project,
  Session,
  SlashCommand,
  Theme,
  ThinkingLevel,
} from '../types'
import { createPreviewSessions, makeSession, previewModels, previewProjects } from '../lib/fixtures'
import { applyStreamEvent } from '../lib/rpc'
import { draftText, normalizeDraft } from '../lib/draft'
import {
  browserLanguage,
  languageFromLocale,
  messages,
  translate,
  type Language,
} from '../lib/locale'

interface WorkspaceState {
  projects: Project[]
  sessions: Session[]
  activeSessionId: string | null
  recentModels: string[]
  sidebarOpen: boolean
  theme: Theme
  language: Language
  languageSource: 'system' | 'user'
  autoReloadAfterToggle: boolean
  autoReloadAfterUpdate: boolean
  piExecutable: string
  models: Model[]
  thinkingLevels: ThinkingLevel[]
  commands: SlashCommand[]
  packages: ExtensionPackage[]
  connection: 'disconnected' | 'connecting' | 'connected' | 'error'
  connectionAction: 'start' | 'switch' | null
  runningSessionId: string | null
  connectionError: string | null
  storageError: string | null
  onboardingCompleted: boolean
  onboardingOpen: boolean
  openOnboarding: () => void
  closeOnboarding: () => void
  completeOnboarding: () => void
  applySystemLocale: (locale: string | null) => void
  toggleSidebar: () => void
  toggleProject: (id: string) => void
  togglePinProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  removeProject: (id: string) => void
  addProject: (path: string, branch?: string | null) => string
  createSession: (projectId: string) => string
  selectSession: (id: string) => void
  togglePinSession: (id: string) => void
  removeSession: (id: string) => boolean
  updateSession: (id: string, patch: Partial<Session>) => void
  appendEvent: (id: string, event: PiEvent) => void
  rememberModel: (key: string) => void
  setPreference: (
    patch: Partial<
      Pick<
        WorkspaceState,
        'theme' | 'language' | 'piExecutable' | 'autoReloadAfterUpdate' | 'autoReloadAfterToggle'
      >
    >,
  ) => void
}

export function createWorkspaceStore(storage: StateStorage, preview = false) {
  const guardedStorage: StateStorage = {
    getItem: (name) => storage.getItem(name),
    removeItem: (name) => storage.removeItem(name),
    setItem: (name, value) => {
      try {
        return storage.setItem(name, value)
      } catch {
        // Avoid recursively persisting the error state. The draft remains in memory.
        queueMicrotask(() => {
          if (!store.getState().storageError)
            store.setState({
              storageError: translate('errors.localSave', store.getState().language),
            })
        })
      }
    },
  }
  const store = create<WorkspaceState>()(
    persist(
      (set, get) => ({
        projects: preview ? structuredClone(previewProjects) : [],
        sessions: preview ? createPreviewSessions() : [],
        activeSessionId: preview ? 'model-selector' : null,
        recentModels: preview ? ['anthropic/claude-sonnet'] : [],
        sidebarOpen: true,
        autoReloadAfterUpdate: true,
        autoReloadAfterToggle: true,
        theme: 'light',
        language: browserLanguage(),
        languageSource: 'system',
        piExecutable: 'pi',
        models: preview ? previewModels : [],
        thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high'],
        commands: [],
        packages: [],
        connection: 'disconnected',
        connectionAction: null,
        runningSessionId: null,
        connectionError: null,
        storageError: null,
        onboardingCompleted: preview,
        onboardingOpen: !preview,
        openOnboarding: () => set({ onboardingOpen: true }),
        closeOnboarding: () => {
          if (get().onboardingCompleted) set({ onboardingOpen: false })
        },
        completeOnboarding: () => set({ onboardingCompleted: true, onboardingOpen: false }),
        applySystemLocale: (locale) => {
          if (get().languageSource === 'system') set({ language: languageFromLocale(locale) })
        },
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        toggleProject: (id) =>
          set((state) => ({
            projects: state.projects.map((project) =>
              project.id === id ? { ...project, collapsed: !project.collapsed } : project,
            ),
          })),
        togglePinProject: (id) =>
          set((state) => ({
            projects: state.projects.map((project) =>
              project.id === id ? { ...project, pinned: !project.pinned } : project,
            ),
          })),
        renameProject: (id, name) => {
          const normalized = name.trim()
          if (!normalized) return
          set((state) => ({
            projects: state.projects.map((project) =>
              project.id === id ? { ...project, name: normalized } : project,
            ),
          }))
        },
        removeProject: (id) =>
          set((state) => ({
            projects: state.projects.map((project) =>
              project.id === id ? { ...project, hidden: true, pinned: false } : project,
            ),
          })),
        addProject: (path, branch = null) => {
          const existing = get().projects.find((project) => project.path === path)
          if (existing) {
            set((state) => ({
              projects: state.projects.map((project) =>
                project.id === existing.id
                  ? { ...project, hidden: false, collapsed: false }
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
        createSession: (projectId) => {
          const session = makeSession(projectId)
          const previous = get().sessions.find((item) => item.id === get().activeSessionId)
          session.modelKey = previous?.modelKey || get().recentModels[0] || ''
          session.thinking = previous?.thinking || 'medium'
          set((state) => ({
            sessions: [session, ...state.sessions],
            activeSessionId: session.id,
            projects: state.projects.map((project) =>
              project.id === projectId ? { ...project, collapsed: false, hidden: false } : project,
            ),
          }))
          return session.id
        },
        selectSession: (id) => {
          const state = get()
          const session = state.sessions.find((session) => session.id === id)
          if (session && !state.runningSessionId && state.connection !== 'connecting')
            set({
              activeSessionId: id,
              connectionError: null,
              projects: state.projects.map((project) =>
                project.id === session.projectId ? { ...project, hidden: false } : project,
              ),
            })
        },
        togglePinSession: (id) =>
          set((state) => ({
            sessions: state.sessions.map((session) =>
              session.id === id ? { ...session, pinned: !session.pinned } : session,
            ),
          })),
        removeSession: (id) => {
          const state = get()
          const removed = state.sessions.find((session) => session.id === id)
          if (
            !removed ||
            state.runningSessionId === id ||
            (state.activeSessionId === id &&
              (state.runningSessionId || state.connection === 'connecting'))
          )
            return false
          const sessions = state.sessions.filter((session) => session.id !== id)
          if (state.activeSessionId !== id) {
            set({ sessions })
            return true
          }
          const ordered = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
          const next =
            ordered.find((session) => session.projectId === removed.projectId) || ordered[0]
          set({
            sessions,
            activeSessionId: next?.id || null,
            connection: 'disconnected',
            connectionError: null,
            commands: [],
            packages: [],
          })
          return true
        },
        updateSession: (id, patch) =>
          set((state) => ({
            sessions: state.sessions.map((session) =>
              session.id === id
                ? {
                    ...session,
                    ...patch,
                    ...(patch.draftNodes !== undefined
                      ? {
                          draftNodes: normalizeDraft(patch.draftNodes),
                          draft: draftText(patch.draftNodes),
                        }
                      : 'draft' in patch
                        ? { draftNodes: undefined }
                        : {}),
                  }
                : session,
            ),
          })),
        appendEvent: (id, event) =>
          set((state) => ({
            sessions: state.sessions.map((session) =>
              session.id === id
                ? { ...session, messages: applyStreamEvent(session.messages, event) }
                : session,
            ),
          })),
        rememberModel: (key) =>
          set((state) => ({
            recentModels: [key, ...state.recentModels.filter((item) => item !== key)].slice(0, 8),
          })),
        setPreference: (patch) =>
          set({ ...patch, ...(patch.language ? { languageSource: 'user' as const } : {}) }),
      }),
      {
        name: preview ? 'pi-desktop-preview-v1' : 'pi-desktop-workspace-v1',
        version: 2,
        storage: createJSONStorage(() => guardedStorage),
        partialize: (state) => ({
          projects: state.projects,
          sessions: state.sessions,
          activeSessionId: state.activeSessionId,
          recentModels: state.recentModels,
          sidebarOpen: state.sidebarOpen,
          theme: state.theme,
          language: state.language,
          languageSource: state.languageSource,
          piExecutable: state.piExecutable,
          autoReloadAfterUpdate: state.autoReloadAfterUpdate,
          autoReloadAfterToggle: state.autoReloadAfterToggle,
          onboardingCompleted: state.onboardingCompleted,
        }),
        migrate: (persisted, version) => {
          const saved = persisted as Partial<WorkspaceState>
          if (version < 2)
            return {
              ...saved,
              sessions: saved.sessions?.map((session) => ({
                ...session,
                title: session.title === messages.zh['sessions.new'] ? '' : session.title,
              })),
            }
          return saved
        },
        merge: (persisted, current) => {
          const saved = persisted as Partial<WorkspaceState> | undefined
          const validLanguage = saved?.language === 'zh' || saved?.language === 'en'
          const languageSource =
            saved?.languageSource === 'system' ? 'system' : validLanguage ? 'user' : 'system'
          // Existing installations already have a workspace. New installations
          // stay in the guide until the user explicitly enters the workspace.
          const onboardingCompleted =
            saved?.onboardingCompleted ??
            (Boolean(saved?.projects?.length || saved?.sessions?.length) ||
              current.onboardingCompleted)
          return {
            ...current,
            ...saved,
            language:
              languageSource === 'user' && validLanguage ? saved.language! : current.language,
            languageSource,
            onboardingCompleted,
            onboardingOpen: !onboardingCompleted,
            sessions: (saved?.sessions || current.sessions).map((session) => ({
              ...session,
              messages: session.messages.map((message) => ({
                ...message,
                blocks: message.blocks.map((block) =>
                  block.type === 'tool' && block.status === 'running'
                    ? { ...block, status: 'interrupted' as const }
                    : block,
                ),
              })),
            })),
          }
        },
      },
    ),
  )
  return store
}

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const fallbackStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}
export const useWorkspace = createWorkspaceStore(
  typeof localStorage === 'undefined' ? fallbackStorage : localStorage,
  !isDesktop,
)
