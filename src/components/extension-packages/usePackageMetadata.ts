import { useCallback, useEffect, useLayoutEffect } from 'react'
import {
  getPackageBatch,
  retainPackageBatchViewer,
  subscribePackageBatch,
  type PackageBatchSnapshot,
} from '../../lib/packageBatch'
import { checkPackageUpdates } from '../../lib/packageUpdates'
import { errorText } from '../../lib/utils'
import { loadCatalog } from './catalogCache'
import type { usePackageState } from './usePackageState'

export function usePackageMetadata({
  mode,
  browsePackages,
  search,
  retry,
  setCatalogResult,
  catalogKey,
  setError,
  sort,
  category,
  page,
  path,
  busy,
  checked,
  infoSource,
  checkRetry,
  setChecking,
  consumeCheckRevision,
  packages,
  packageInfo,
  setChecked,
  name,
  info,
  updateInfo,
  setInfoCache,
  setBatchStates,
  setBatchSummary,
  setBusy,
  setFailedOperation,
  setNotice,
  setChanged,
  setBatchFeedback,
  setToastMessage,
}: Pick<
  ReturnType<typeof usePackageState>,
  | 'mode'
  | 'search'
  | 'retry'
  | 'setCatalogResult'
  | 'catalogKey'
  | 'setError'
  | 'sort'
  | 'category'
  | 'page'
  | 'path'
  | 'busy'
  | 'checked'
  | 'infoSource'
  | 'checkRetry'
  | 'setChecking'
  | 'consumeCheckRevision'
  | 'packages'
  | 'setChecked'
  | 'name'
  | 'info'
  | 'updateInfo'
  | 'setInfoCache'
  | 'setBatchStates'
  | 'setBatchSummary'
  | 'setBusy'
  | 'setFailedOperation'
  | 'setNotice'
  | 'setChanged'
  | 'setBatchFeedback'
  | 'setToastMessage'
> & {
  browsePackages: (
    query: string,
    options: import('../../lib/packages').CatalogOptions,
    signal?: AbortSignal | undefined,
  ) => Promise<import('../../lib/packages').CatalogPage>
  packageInfo: (
    name: string,
    signal?: AbortSignal | undefined,
  ) => Promise<import('../../lib/packages').PackageInfo>
}) {
  useEffect(() => {
    if (mode !== 'discover') return
    let cancelled = false
    loadCatalog(browsePackages, search, { sort, category, page }, retry > 0)
      .then((result) => {
        if (!cancelled) setCatalogResult({ key: catalogKey, ...result })
      })
      .catch((error) => {
        if (!cancelled) {
          setError(errorText(error))
          setCatalogResult({ key: catalogKey, items: [], hasNext: false })
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    mode,
    search,
    retry,
    browsePackages,
    sort,
    category,
    page,
    catalogKey,
    setError,
    setCatalogResult,
  ])

  useEffect(() => {
    if (mode !== 'installed' || !path || busy === 'batch') return
    if (checked?.source === infoSource && checked.revision === checkRetry) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setChecking(true)
    })
    // Consume the refresh revision once. Tab changes and effect restarts reuse
    // the resulting cached/in-flight request instead of forcing another fetch.
    const force = consumeCheckRevision(checkRetry)
    checkPackageUpdates(path, packages, packageInfo, force)
      .then((result) => {
        if (!cancelled) {
          // Finish both states together: updating `checked` invalidates this effect.
          setChecking(false)
          setChecked({ source: infoSource, result, revision: checkRetry })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setChecking(false)
          setError(errorText(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    mode,
    path,
    infoSource,
    packages,
    packageInfo,
    checkRetry,
    busy,
    checked?.source,
    checked?.revision,
    setError,
    setChecking,
    setChecked,
    consumeCheckRevision,
  ])

  useEffect(() => {
    if (mode === 'installed' || !name || info[name] || updateInfo[name]) return
    const controller = new AbortController()
    packageInfo(name, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setInfoCache((current) => ({
            source: infoSource,
            items: { ...(current.source === infoSource ? current.items : {}), [name]: result },
          }))
      })
      .catch(() => {
        /* The installed source remains available when registry metadata is offline. */
      })
    return () => controller.abort()
  }, [mode, name, info, updateInfo, infoSource, retry, packageInfo, setInfoCache])

  const showPackageBatch = useCallback(
    (batch: PackageBatchSnapshot) => {
      setBatchStates(batch.states)
      setBatchSummary(batch.summary)
      setBusy(batch.busy)
      setError(batch.error)
      setFailedOperation(batch.reloadFailed ? { action: 'reload' } : null)
      setNotice(batch.notice)
      setChanged(batch.changed)
      setBatchFeedback(true)
      if (!batch.toastSeen) setToastMessage(batch.toast)
      if (batch.toast) batch.toastSeen = true
    },
    [
      setBatchStates,
      setBatchSummary,
      setBusy,
      setError,
      setFailedOperation,
      setNotice,
      setChanged,
      setBatchFeedback,
      setToastMessage,
    ],
  )

  useLayoutEffect(() => {
    if (!path) return
    const apply = () => {
      const batch = getPackageBatch()
      if (!batch || batch.path !== path) return
      showPackageBatch(batch)
    }
    apply()
    const unsubscribe = subscribePackageBatch(apply)
    const release = retainPackageBatchViewer(path)
    return () => {
      unsubscribe()
      release()
    }
  }, [path, showPackageBatch])
  return {}
}
