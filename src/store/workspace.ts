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
  let storageRevision = 0
  function reportStorageResult(revision: number, failed: boolean) {
    queueMicrotask(() => {
      if (revision !== storageRevision) return
      const state = store.getState()
      const error = failed ? translate('errors.localSave', state.language) : null
      if (state.storageError !== error) store.setState({ storageError: error })
    })
  }
  const guardedStorage: StateStorage = {
    getItem: (name) => storage.getItem(name),
    removeItem: (name) => {
      // A queued recovery report must not recreate a workspace after it was cleared.
      storageRevision++
      return storage.removeItem(name)
    },
    setItem: (name, value) => {
      const revision = ++storageRevision
      try {
        const written = storage.setItem(name, value)
        return Promise.resolve(written).then(
          () => reportStorageResult(revision, false),
          () => reportStorageResult(revision, true),
        )
      } catch {
        // Report outside the write; transient error state is excluded from persistence.
        reportStorageResult(revision, true)
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
  async function savePersistence() {
    // Force a fresh snapshot even when the previous failed write consumed the queue.
    const options = store.persist.getOptions()
    if (!options.name) throw new Error('Workspace persistence is unavailable')
    await persistence.save(options.name, {
      state: options.partialize ? options.partialize(store.getState()) : store.getState(),
      version: options.version,
    })
    const error = store.getState().storageError
    if (error) throw new Error(error)
  }
  return Object.assign(store, { flushPersistence: persistence.flush, savePersistence })
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
