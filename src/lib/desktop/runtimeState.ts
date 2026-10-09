import type { ExtensionPackage } from '../../types'

export interface PiConnection {
  id: string
  sessionId: string | null
  bindingVersion: number
  path: string
  executable: string
  packages: ExtensionPackage[]
  ponytailLoaded?: boolean
  bindingUncertain?: boolean
  needsReconcile?: boolean
}

interface RuntimeState {
  currentRun: PiConnection | null
  projectConnections: Map<string, PiConnection>
  connecting: Promise<void> | null
  initializing: Promise<void> | null
}

// Shared by lifecycle, requests and events so every operation checks the same binding.
export const runtimeState: RuntimeState = {
  currentRun: null,
  projectConnections: new Map(),
  connecting: null,
  initializing: null,
}
