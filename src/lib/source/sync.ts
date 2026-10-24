import type { Translator } from '../locale'
import type { GitSyncState } from './types'

export function syncRequest(state: GitSyncState) {
  return {
    expectedHead: state.branch.head,
    expectedBranch: state.branch.current,
    expectedUpstream: state.upstream,
  }
}
export function syncError(error: unknown, t: Translator) {
  const message = error instanceof Error ? error.message : String(error)
  switch (message) {
    case 'SOURCE_SYNC_BUSY':
      return t('source.syncBusy')
    case 'SOURCE_SYNC_CHANGED':
      return t('source.syncChanged')
    case 'SOURCE_SYNC_DIRTY':
      return t('source.syncDirty')
    case 'SOURCE_SYNC_NO_REMOTE':
      return t('source.noRemote')
    case 'SOURCE_SYNC_NO_UPSTREAM':
      return t('source.noUpstream')
    case 'SOURCE_SYNC_PENDING':
      return t('source.syncPending')
    case 'SOURCE_SYNC_MARKERS':
      return t('source.conflictMarkers')
    case 'SOURCE_SYNC_LIMIT':
      return t('source.conflictExternal')
    default:
      return message
  }
}
export const fetchIntervals = [0, 1, 5, 10] as const
const fetchPreferenceEvent = 'pi:git-auto-fetch-changed'
export function readFetchInterval(path: string) {
  try {
    const value = Number(localStorage.getItem(`pi.git-auto-fetch.v1:${path}`))
    return fetchIntervals.includes(value as (typeof fetchIntervals)[number]) ? value : 0
  } catch {
    return 0
  }
}
export function saveFetchInterval(path: string, minutes: number) {
  if (!fetchIntervals.includes(minutes as (typeof fetchIntervals)[number]))
    throw new Error('Invalid fetch interval')
  localStorage.setItem(`pi.git-auto-fetch.v1:${path}`, String(minutes))
  window.dispatchEvent(new CustomEvent(fetchPreferenceEvent, { detail: path }))
}

export function subscribeFetchInterval(path: string, notify: () => void) {
  const changed = (event: Event) => {
    if ((event as CustomEvent<string>).detail === path) notify()
  }
  const stored = (event: StorageEvent) => {
    if (event.key === null || event.key === `pi.git-auto-fetch.v1:${path}`) notify()
  }
  window.addEventListener(fetchPreferenceEvent, changed)
  window.addEventListener('storage', stored)
  return () => {
    window.removeEventListener(fetchPreferenceEvent, changed)
    window.removeEventListener('storage', stored)
  }
}
