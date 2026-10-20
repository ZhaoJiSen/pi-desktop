import type { ExtensionPackage } from '../types'
import { pageFromPath } from '../router/paths'
import { t } from './i18n'
import {
  clearCompletedPackageUpdates,
  packageKey,
  updatePackageBatch,
  type PackageUpdateState,
} from './packageUpdates'
import { errorText } from './utils'

export type PackageBatchSnapshot = {
  path: string
  phase: 'running' | 'settled'
  states: Record<string, PackageUpdateState>
  summary: { succeeded: number; failed: number } | null
  notice: string
  error: string
  changed: boolean
  busy: 'batch' | 'reload' | null
  toast: string
  toastSeen: boolean
  reloadFailed: boolean
}

let snapshot: PackageBatchSnapshot | null = null
let running = false
let generation = 0
let viewers = 0
let viewerPath: string | null = null
export type PackageBatchNotice = { message: string; tone: 'success' | 'warning' }

const listeners = new Set<() => void>()
const notices = new Set<(notice: PackageBatchNotice) => void>()

export function getPackageBatch() {
  return snapshot
}

export function subscribePackageBatch(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function onPackageBatchNotice(listener: (notice: PackageBatchNotice) => void) {
  notices.add(listener)
  return () => notices.delete(listener)
}

export function reportPackageBatchNotice(message: string, tone: PackageBatchNotice['tone']) {
  const text = message.trim()
  if (!text) return
  for (const listener of notices) listener({ message: text, tone })
}

export function isPackageBatchRunning() {
  return running
}

export function retainPackageBatchViewer(path: string) {
  viewers += 1
  viewerPath = path
  return () => {
    viewers = Math.max(0, viewers - 1)
    if (viewerPath === path && viewers === 0) viewerPath = null
  }
}

// The extensions page is showing this project. An empty hash means the caller
// mounted the manager without the router, which the unit tests do.
export function isPackageBatchVisible(path: string) {
  if (viewers <= 0 || viewerPath !== path) return false
  if (typeof window === 'undefined') return true
  const hash = window.location.hash
  if (!hash) return true
  const pathname = hash.slice(1).split('?')[0] || '/'
  return pageFromPath(pathname) === 'extensions'
}

function emit() {
  for (const listener of listeners) listener()
}

function publish(next: PackageBatchSnapshot) {
  snapshot = next
  emit()
}

export function clearPackageBatch(path?: string) {
  if (!snapshot || snapshot.phase === 'running') return
  if (path && snapshot.path !== path) return
  snapshot = null
  emit()
}

export function resetPackageBatch() {
  generation += 1
  running = false
  snapshot = null
  viewers = 0
  viewerPath = null
  emit()
}

function batchMessage(result: { succeeded: number; failed: number }) {
  return result.failed
    ? t('packages.batchResult', result)
    : t('packages.batchSuccess', { count: result.succeeded })
}

export async function runPackageBatch(input: {
  path: string
  targets: ExtensionPackage[]
  update: (item: ExtensionPackage) => Promise<void>
  refresh: (path: string) => Promise<unknown>
  canReload: () => boolean
  reload: () => Promise<boolean>
  onUpdated?: () => void
}) {
  if (running || !input.targets.length) return
  running = true
  const generationId = ++generation
  const live = () => generationId === generation
  let current: PackageBatchSnapshot = {
    path: input.path,
    phase: 'running',
    states: Object.fromEntries(
      input.targets.map((item) => [packageKey(item), { status: 'queued' as const }]),
    ),
    summary: null,
    notice: '',
    error: '',
    changed: false,
    busy: 'batch',
    toast: '',
    toastSeen: false,
    reloadFailed: false,
  }
  const updateSnapshot = (partial: Partial<PackageBatchSnapshot>) => {
    if (!live()) return
    current = { ...current, ...partial }
    publish(current)
  }
  updateSnapshot({})
  try {
    const result = await updatePackageBatch(input.targets, input.update, (item, state) => {
      updateSnapshot({ states: { ...current.states, [packageKey(item)]: state } })
    })
    if (!live()) return
    const notice = batchMessage(result)
    let error = ''
    let reloaded = false
    let reloadFailed = false
    const states = clearCompletedPackageUpdates(current.states)
    try {
      await input.refresh(input.path)
      input.onUpdated?.()
      if (result.succeeded && input.canReload()) {
        updateSnapshot({ states, summary: result, notice, changed: true, busy: 'reload' })
        try {
          reloaded = await input.reload()
        } catch (reloadError) {
          error = errorText(reloadError)
          reloadFailed = true
        }
      }
    } catch (refreshError) {
      error = errorText(refreshError)
    }
    if (!live()) return
    const visible = isPackageBatchVisible(input.path)
    updateSnapshot({
      phase: 'settled',
      states,
      summary: result,
      notice: visible && reloaded ? '' : notice,
      error,
      changed: result.succeeded > 0 && !reloaded,
      busy: null,
      toast: visible && reloaded ? t('packages.reloadSuccess') : '',
      toastSeen: false,
      reloadFailed,
    })
    if (!visible)
      reportPackageBatchNotice(error || notice, error || result.failed ? 'warning' : 'success')
  } catch (unexpected) {
    if (!live()) return
    const error = errorText(unexpected)
    updateSnapshot({
      phase: 'settled',
      busy: null,
      error,
      states: clearCompletedPackageUpdates(current.states),
    })
    if (!isPackageBatchVisible(input.path)) reportPackageBatchNotice(error, 'warning')
  } finally {
    if (live()) running = false
  }
}
