import type { CommandSource } from '../../types'

export type CapabilityIcon = import('./icons').CapabilityIconName
export interface Capability {
  id: string
  name: string
  description: string
  icon: CapabilityIcon
  alias: string
  prompt: string
  scope: 'once' | 'session'
  enabled: boolean
  pinned: boolean
  builtin?: 'review' | 'commit' | 'plan' | 'explain' | 'tests'
  target?: {
    name: string
    source: Exclude<CommandSource, 'builtin'>
    origin: string
  }
  arguments?: string
  modifies: boolean
  readOnly?: boolean
}
export interface CapabilityPreferences {
  showShortcuts: boolean
  visibleCount: number
  items: Capability[]
  /** Desktop invocation preferences only; does not unload Pi extensions. */
  disabledCommandIds?: string[]
}
export interface CapabilitySelection {
  mode?: Capability
  task?: Capability
}
export interface CapabilitySubmission extends CapabilitySelection {
  uncertain?: boolean
  id: string
  body: string
  attachmentKey: string
}
export interface CapabilityReceipt {
  id: string
  body: string
  timestamp: number
  userIndex?: number
  sourceTimestamp?: number
  selection: CapabilitySelection
}
export interface CapabilityBridgeState {
  version: number
  plan: boolean
  mode?: Capability
  tools: string[]
  receipts: CapabilityReceipt[]
  preparedId?: string
  unavailableTargets?: string[]
}
