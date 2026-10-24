import { create } from 'zustand'
import { persist, type StateStorage } from 'zustand/middleware'
import { resolveColorMode, systemIsDark } from '../lib/appearance'
import { createPreviewSessions, previewModels, previewProjects } from '../lib/fixtures'
import { defaultFonts } from '../lib/fonts'
import { browserLanguage, languageFromLocale, translate } from '../lib/locale'
import { defaultNotificationPreferences } from '../lib/notificationPreferences'
import { createWorkspacePersistence } from './persistence'
import { projectActions } from './projectActions'
import { sessionActions } from './sessionActions'
import { workspaceRestore } from './workspaceRestore'
import type { WorkspaceState } from './workspaceTypes'
export type { SettingsSectionId } from './workspaceTypes'

export function createWorkspaceStore(storage: StateStorage, preview = false) {
  let streamingWrite = false
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
  const persistence = createWorkspacePersistence<Partial<WorkspaceState>>(
    guardedStorage,
    () => streamingWrite,
  )
  const store = create<WorkspaceState>()(
    persist(
      (set, get) => ({
        settingsSection: 'general',
        commandCapabilityId: null,
        capabilityPreferences: { showShortcuts: true, visibleCount: 2, items: [] },
        capabilityBridge: null,
        capabilityBridgeError: '',
        projects: preview ? structuredClone(previewProjects) : [],
        sessions: preview ? createPreviewSessions() : [],
        activeSessionId: preview ? 'model-selector' : null,
        recentModels: preview ? ['anthropic/claude-sonnet'] : [],
        sidebarOpen: true,
        recentCollapsed: false,
        autoReloadAfterUpdate: true,
        autoReloadAfterToggle: true,
        wrapLines: false,
        gitChangesView: 'tree',
        notificationPreferences: defaultNotificationPreferences,
        theme: 'system',
        windowMaterial: 'blur',
        palette: 'ink',
        palettesByMode: { light: 'ink', dark: 'ink' },
        accentOverrides: {},
        fonts: defaultFonts,
        language: browserLanguage(),
        languageSource: 'system',
        piExecutable: 'pi',
        lastCustomPiExecutable: '',
        extensionSelection: null,
        piUpdating: false,
        piBusyRuns: [],
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
        ...projectActions(set, get),
        ...sessionActions(set, get, (value) => {
          streamingWrite = value
        }),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        toggleRecentCollapsed: () => set((state) => ({ recentCollapsed: !state.recentCollapsed })),

        setPreference: (patch) =>
          set((state) => {
            const mode = resolveColorMode(patch.theme ?? state.theme, systemIsDark())
            const palettesByMode = {
              ...(patch.palettesByMode ?? state.palettesByMode),
              ...(patch.palette ? { [mode]: patch.palette } : {}),
            }
            return {
              ...patch,
              palettesByMode,
              palette: palettesByMode[mode],
              ...(patch.language ? { languageSource: 'user' as const } : {}),
            }
          }),
      }),
      {
        name: preview ? 'pi-desktop-preview-v1' : 'pi-desktop-workspace-v1',
        version: 3,
        ...workspaceRestore,
        storage: persistence.storage,
      },
    ),
  )
  store.subscribe((state, previous) => {
    if (previous.runningSessionId && !state.runningSessionId) void persistence.flush()
  })
  return Object.assign(store, { flushPersistence: persistence.flush })
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
