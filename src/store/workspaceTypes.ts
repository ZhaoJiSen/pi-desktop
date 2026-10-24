import { type AccentOverrides, type ModePalettes } from '../lib/appearance'
import type { CapabilityBridgeState, CapabilityPreferences } from '../lib/capabilities/types'
import { type FontPreferences } from '../lib/fonts'
import { type Language } from '../lib/locale'
import { type NotificationPreferences } from '../lib/notificationPreferences'
import type {
  ExtensionPackage,
  Model,
  PiEvent,
  Project,
  Session,
  SlashCommand,
  Theme,
  ThinkingLevel,
  WindowMaterial,
} from '../types'
import { type Palette } from '../types'
export type SettingsSectionId =
  | 'general'
  | 'git'
  | 'appearance'
  | 'notifications'
  | 'shortcuts'
  | 'capabilities'
  | 'extensions'
  | 'connection'

export interface WorkspaceState {
  commandCapabilityId: string | null
  settingsSection: SettingsSectionId
  capabilityPreferences: CapabilityPreferences
  capabilityBridge: CapabilityBridgeState | null
  capabilityBridgeError: string
  projects: Project[]
  sessions: Session[]
  activeSessionId: string | null
  recentModels: string[]
  sidebarOpen: boolean
  recentCollapsed: boolean
  theme: Theme
  windowMaterial: WindowMaterial
  palette: Palette
  palettesByMode: ModePalettes
  accentOverrides: AccentOverrides
  fonts: FontPreferences
  language: Language
  languageSource: 'system' | 'user'
  autoReloadAfterToggle: boolean
  autoReloadAfterUpdate: boolean
  wrapLines: boolean
  gitChangesView: 'tree' | 'list'
  notificationPreferences: NotificationPreferences
  piExecutable: string
  lastCustomPiExecutable: string
  extensionSelection: { key: string | null; category: '' | 'skill' } | null
  piUpdating: boolean
  piBusyRuns: string[]
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
  toggleRecentCollapsed: () => void
  toggleProject: (id: string) => void
  togglePinProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  removeProject: (id: string) => void
  addProject: (path: string, branch?: string | null) => string
  ensureRecentProject: (path: string) => string
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
        | 'theme'
        | 'windowMaterial'
        | 'palette'
        | 'palettesByMode'
        | 'accentOverrides'
        | 'fonts'
        | 'language'
        | 'piExecutable'
        | 'lastCustomPiExecutable'
        | 'autoReloadAfterUpdate'
        | 'autoReloadAfterToggle'
        | 'wrapLines'
        | 'gitChangesView'
        | 'notificationPreferences'
        | 'capabilityPreferences'
      >
    >,
  ) => void
}
