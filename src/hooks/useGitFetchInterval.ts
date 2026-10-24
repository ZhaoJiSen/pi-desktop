import { useCallback, useSyncExternalStore } from 'react'
import { readFetchInterval, subscribeFetchInterval } from '../lib/source/sync'

/** Shared by Settings and the live workspace; repository-specific values stay in the existing keys. */
export function useGitFetchInterval(path: string) {
  const subscribe = useCallback(
    (notify: () => void) => subscribeFetchInterval(path, notify),
    [path],
  )
  const snapshot = useCallback(() => readFetchInterval(path), [path])
  return useSyncExternalStore(subscribe, snapshot, () => 0)
}
