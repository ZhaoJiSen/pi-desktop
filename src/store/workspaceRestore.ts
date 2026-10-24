import type { PersistOptions } from 'zustand/middleware'
import {
  resolveColorMode,
  restoreAccentOverrides,
  restoreModePalettes,
  systemIsDark,
} from '../lib/appearance'
import { restoreFonts } from '../lib/fonts'
import { messages } from '../lib/locale'
import { restoreNotificationPreferences } from '../lib/notificationPreferences'
import { palettes, type Palette } from '../types'
import type { WorkspaceState } from './workspaceTypes'
export const workspaceRestore: Pick<
  PersistOptions<WorkspaceState, Partial<WorkspaceState>>,
  'partialize' | 'migrate' | 'merge'
> = {
  partialize: (state) => ({
    projects: state.projects,
    sessions: state.sessions,
    activeSessionId: state.activeSessionId,
    recentModels: state.recentModels,
    sidebarOpen: state.sidebarOpen,
    recentCollapsed: state.recentCollapsed,
    theme: state.theme,
    windowMaterial: state.windowMaterial,
    palette: state.palette,
    palettesByMode: state.palettesByMode,
    accentOverrides: state.accentOverrides,
    fonts: state.fonts,
    language: state.language,
    languageSource: state.languageSource,
    piExecutable: state.piExecutable,
    lastCustomPiExecutable: state.lastCustomPiExecutable,
    autoReloadAfterUpdate: state.autoReloadAfterUpdate,
    autoReloadAfterToggle: state.autoReloadAfterToggle,
    wrapLines: state.wrapLines,
    gitChangesView: state.gitChangesView,
    notificationPreferences: state.notificationPreferences,
    onboardingCompleted: state.onboardingCompleted,
    capabilityPreferences: state.capabilityPreferences,
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
      (Boolean(saved?.projects?.length || saved?.sessions?.length) || current.onboardingCompleted)
    const palette = palettes.includes(saved?.palette as Palette)
      ? (saved?.palette as Palette)
      : current.palette
    const palettesByMode = restoreModePalettes(saved?.palettesByMode, palette)
    return {
      ...current,
      ...saved,
      gitChangesView: saved?.gitChangesView === 'list' ? 'list' : 'tree',
      notificationPreferences: restoreNotificationPreferences(saved?.notificationPreferences),
      capabilityPreferences: saved?.capabilityPreferences || current.capabilityPreferences,
      palette: palettesByMode[resolveColorMode(saved?.theme ?? current.theme, systemIsDark())],
      palettesByMode,
      accentOverrides: restoreAccentOverrides(saved?.accentOverrides),
      fonts: restoreFonts(saved?.fonts),
      windowMaterial:
        saved?.windowMaterial === 'off' ||
        saved?.windowMaterial === 'blur' ||
        saved?.windowMaterial === 'glass'
          ? saved.windowMaterial
          : 'blur',
      language: languageSource === 'user' && validLanguage ? saved.language! : current.language,
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
}
