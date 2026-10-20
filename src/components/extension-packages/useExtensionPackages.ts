import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDebounce } from 'ahooks'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import {
  hasUpdate,
  npmName,
  openPackagePage,
  packageName,
  type PackageInfo,
  type CatalogOptions,
} from '../../lib/packages'
import {
  clearPackageBatch,
  getPackageBatch,
  isPackageBatchRunning,
  retainPackageBatchViewer,
  runPackageBatch,
  subscribePackageBatch,
  type PackageBatchSnapshot,
} from '../../lib/packageBatch'
import {
  checkPackageUpdates,
  clearCompletedPackageUpdates,
  metadataSource,
  packageKey as keyOf,
  summarizePackageCheck,
  updatablePackages,
  type UpdateCheck,
  type PackageUpdateState,
} from '../../lib/packageUpdates'
import { errorText } from '../../lib/utils'
import type { ExtensionPackage } from '../../types'
import { PackageServices } from './services'
import { loadCatalog } from './catalogCache'

const emptyInfo: Record<string, PackageInfo> = {}

export function useExtensionPackages() {
  const { browsePackages, packageInfo, managePackage, refreshExtensionPackages, connectSession } =
    useContext(PackageServices)
  const packages = useWorkspace((state) => state.packages)
  const active = useWorkspace((state) => state.activeSessionId)
  const path = useWorkspace(
    (state) =>
      state.projects.find(
        (project) =>
          project.id ===
          state.sessions.find((session) => session.id === state.activeSessionId)?.projectId,
      )?.path,
  )
  const running = useWorkspace(
    (state) => Boolean(state.runningSessionId) || state.connection === 'connecting',
  )
  const [mode, setMode] = useState<'installed' | 'discover'>(() =>
    useWorkspace.getState().extensionSelection?.category === 'skill' ? 'discover' : 'installed',
  )
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<CatalogOptions['sort']>('downloads')
  const [category, setCategory] = useState<CatalogOptions['category']>(
    () => useWorkspace.getState().extensionSelection?.category || '',
  )
  const [page, setPage] = useState(1)
  const search = useDebounce(query.trim(), { wait: 300 })
  const [mobileDetail, setMobileDetail] = useState(() =>
    Boolean(useWorkspace.getState().extensionSelection?.key),
  )
  const [selected, setSelected] = useState<string | null>(
    () => useWorkspace.getState().extensionSelection?.key || null,
  )
  const [catalogResult, setCatalogResult] = useState<{
    key: string
    items: PackageInfo[]
    hasNext: boolean
  } | null>(null)
  const catalog = catalogResult?.items || []
  const infoSource = metadataSource(path, packages)
  const [infoCache, setInfoCache] = useState<{
    source: string
    items: Record<string, PackageInfo>
  }>({
    source: '',
    items: {},
  })
  const info = infoCache.source === infoSource ? infoCache.items : emptyInfo
  const [checked, setChecked] = useState<{
    source: string
    result: UpdateCheck
    revision: number
  } | null>(null)
  const knownInfo = checked?.result.items || emptyInfo
  const updateInfo = checked?.source === infoSource ? checked.result.items : emptyInfo
  const checkErrors = checked?.source === infoSource ? checked.result.errors : {}
  const [manualChecking, setChecking] = useState(false)
  const [checkRetry, setCheckRetry] = useState(0)
  const forcedCheckRevision = useRef(0)

  const restoredBatch = getPackageBatch()
  const restored = restoredBatch?.path === path ? restoredBatch : null
  const [batchStates, setBatchStates] = useState<Record<string, PackageUpdateState>>(
    restored?.states ?? {},
  )
  const [batchSummary, setBatchSummary] = useState<{ succeeded: number; failed: number } | null>(
    restored?.summary ?? null,
  )
  const operation = useRef(false)
  const [busy, setBusy] = useState<string | null>(restored?.busy ?? null)
  const checking =
    manualChecking ||
    (busy !== 'batch' &&
      mode === 'installed' &&
      Boolean(path) &&
      (checked?.source !== infoSource || checked?.revision !== checkRetry))
  const [error, setError] = useState(restored?.error ?? '')
  const [failedOperation, setFailedOperation] = useState<
    | { action: 'install' | 'update' | 'remove' | 'enable' | 'disable'; target: ExtensionPackage }
    | { action: 'reload' }
    | null
  >(restored?.reloadFailed ? { action: 'reload' } : null)
  const [notice, setNotice] = useState(restored?.notice ?? '')
  const [changed, setChanged] = useState(restored?.changed ?? false)
  const [batchFeedback, setBatchFeedback] = useState(Boolean(restored))
  const [toastMessage, setToastMessage] = useState(
    restored && !restored.toastSeen ? restored.toast : '',
  )
  const [removing, setRemoving] = useState<ExtensionPackage | null>(null)
  const [retry, setRetry] = useState(0)
  const catalogKey = JSON.stringify([search, sort, category, page, retry])
  const loading = mode === 'discover' && catalogResult?.key !== catalogKey
  const t = useT()
  const items: ExtensionPackage[] =
    mode === 'installed'
      ? packages.filter((item) =>
          `${item.source} ${item.description || ''}`.toLowerCase().includes(search.toLowerCase()),
        )
      : catalog.map((item) => ({
          source: `npm:${item.name}`,
          scope: 'global',
          description: item.description,
        }))
  const item = items.find((item) => keyOf(item) === selected) || items[0]
  const name = item ? npmName(item.source) : null
  const detail = name
    ? updateInfo[name] ||
      info[name] ||
      knownInfo[name] ||
      catalog.find((item) => item.name === name)
    : undefined
  const installed =
    item && (mode === 'installed' ? item : packages.find((pkg) => npmName(pkg.source) === name))
  const updateAvailable = !checking && installed && detail && hasUpdate(installed.version, detail)
  const pinned = installed && name && installed.source !== `npm:${name}`
  const updateTargets = updatablePackages(packages, updateInfo)
  const updates = updateTargets.length
  const checkSummary = summarizePackageCheck(packages, { items: updateInfo, errors: checkErrors })
  const { unknown } = checkSummary
  const batchDone = Object.values(batchStates).filter(
    (state) => state.status === 'done' || state.status === 'failed',
  ).length

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
  }, [mode, search, retry, browsePackages, sort, category, page, catalogKey])

  useEffect(() => {
    if (mode !== 'installed' || !path || busy === 'batch') return
    if (checked?.source === infoSource && checked.revision === checkRetry) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setChecking(true)
    })
    // Consume the refresh revision once. Tab changes and effect restarts reuse
    // the resulting cached/in-flight request instead of forcing another fetch.
    const force = checkRetry > forcedCheckRevision.current
    forcedCheckRevision.current = checkRetry
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
  }, [mode, name, info, updateInfo, infoSource, retry, packageInfo])

  const showPackageBatch = useCallback((batch: PackageBatchSnapshot) => {
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
  }, [])

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

  function batchForThisPath() {
    const batch = getPackageBatch()
    return isPackageBatchRunning() && batch?.path === path
  }

  function batchForAnotherPath() {
    const batch = getPackageBatch()
    return Boolean(isPackageBatchRunning() && batch && batch.path !== path)
  }

  function canReloadBatch(sessionId: string | null) {
    const state = useWorkspace.getState()
    return Boolean(
      state.autoReloadAfterUpdate &&
      sessionId &&
      state.activeSessionId === sessionId &&
      !state.runningSessionId,
    )
  }

  async function checkUpdates() {
    if (checking || operation.current || batchForThisPath() || !path) return
    clearPackageBatch(path)
    setChecking(true)
    setError('')
    setFailedOperation(null)
    try {
      await refreshExtensionPackages(path)
      setCheckRetry((value) => value + 1)
    } catch (error) {
      setError(errorText(error))
      setChecking(false)
    }
  }

  async function autoReloadPackages(reason: 'update' | 'toggle') {
    const state = useWorkspace.getState()
    if (
      !(reason === 'update' ? state.autoReloadAfterUpdate : state.autoReloadAfterToggle) ||
      !active ||
      state.activeSessionId !== active ||
      state.runningSessionId
    )
      return
    setBusy('reload')
    try {
      await connectSession(active, true)
      setChanged(false)
      setNotice('')
      setToastMessage(t('packages.reloadSuccess'))
    } catch (error) {
      setFailedOperation({ action: 'reload' })
      setError(errorText(error))
    }
  }

  async function updateAll() {
    if (batchForAnotherPath()) {
      setError(t('packages.batchBusy'))
      return
    }
    if (
      operation.current ||
      batchForThisPath() ||
      checking ||
      running ||
      !path ||
      !updateTargets.length
    )
      return
    const projectPath = path
    const sessionId = active
    await runPackageBatch({
      path: projectPath,
      targets: updateTargets,
      update: (pkg) => managePackage('update', pkg, projectPath),
      refresh: refreshExtensionPackages,
      canReload: () => canReloadBatch(sessionId),
      reload: async () => {
        if (!canReloadBatch(sessionId) || !sessionId) return false
        await connectSession(sessionId, true)
        return true
      },
      onUpdated: () => {
        setInfoCache({ source: '', items: {} })
        setCheckRetry((value) => value + 1)
      },
    })
  }

  async function perform(
    action: 'install' | 'update' | 'remove' | 'enable' | 'disable',
    target: ExtensionPackage,
  ) {
    if (batchForAnotherPath()) {
      setError(t('packages.batchBusy'))
      return
    }
    if (operation.current || batchForThisPath() || running || !path) return
    clearPackageBatch(path)
    operation.current = true
    setBatchFeedback(false)
    setToastMessage('')
    setBusy(action)
    setBatchStates(action === 'update' ? { [keyOf(target)]: { status: 'updating' } } : {})
    setBatchSummary(null)
    setFailedOperation(null)
    setError('')
    setNotice('')
    try {
      await managePackage(action, target, path)
      if (action === 'update') setBatchStates({ [keyOf(target)]: { status: 'done' } })
      setChanged(true)
      await refreshExtensionPackages(path)
      if (action !== 'enable' && action !== 'disable') {
        setInfoCache({ source: '', items: {} })
        setCheckRetry((value) => value + 1)
      }
      const successMessage = t(
        action === 'install'
          ? 'packages.installedSuccess'
          : action === 'update'
            ? 'packages.updatedSuccess'
            : action === 'enable'
              ? 'packages.enabledSuccess'
              : action === 'disable'
                ? 'packages.disabledSuccess'
                : 'packages.removedSuccess',
        { name: packageName(target.source) },
      )
      setRemoving(null)
      if (action === 'update') await autoReloadPackages('update')
      else if (action === 'enable' || action === 'disable') await autoReloadPackages('toggle')
      const preferences = useWorkspace.getState()
      const automatic =
        action === 'update'
          ? preferences.autoReloadAfterUpdate
          : action === 'enable' || action === 'disable'
            ? preferences.autoReloadAfterToggle
            : false
      if (!automatic) setToastMessage(successMessage)
    } catch (error) {
      if (action === 'update')
        setBatchStates({ [keyOf(target)]: { status: 'failed', error: errorText(error) } })
      setFailedOperation({ action, target })
      setError(errorText(error))
    } finally {
      operation.current = false
      setBatchStates(clearCompletedPackageUpdates)
      setBusy(null)
    }
  }

  async function reload() {
    if (!active || busy || running || batchForThisPath()) return
    clearPackageBatch(path)
    setBusy('reload')
    setError('')
    setFailedOperation(null)
    try {
      await connectSession(active, true)
      setChanged(false)
      setNotice('')
      setToastMessage(t('packages.reloadSuccess'))
    } catch (error) {
      setFailedOperation({ action: 'reload' })
      setError(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  function changeMode(next: typeof mode) {
    clearPackageBatch(path)
    setMode(next)
    setSelected(null)
    setMobileDetail(false)
    setQuery('')
    setError('')
    setNotice('')
    setChanged(false)
    setBatchFeedback(false)
    setPage(1)
  }

  function changeQuery(value: string) {
    setQuery(value)
    setPage(1)
    setMobileDetail(false)
  }

  function changeSort(next: typeof sort) {
    setSort(next)
    resetCatalogSelection()
  }

  function changeCategory(next: typeof category) {
    setCategory(next)
    resetCatalogSelection()
  }

  function resetCatalogSelection() {
    setPage(1)
    setSelected(null)
    setMobileDetail(false)
    setError('')
  }

  function selectPackage(pkg: ExtensionPackage) {
    setSelected(keyOf(pkg))
    setMobileDetail(true)
    setError('')
    setFailedOperation(null)
  }

  function changePage(offset: number) {
    setPage((value) => value + offset)
    setSelected(null)
  }

  function retryOperation() {
    if (failedOperation) {
      if (failedOperation.action === 'reload') void reload()
      else void perform(failedOperation.action, failedOperation.target)
    } else {
      setError('')
      if (mode === 'discover') setRetry((value) => value + 1)
      else void checkUpdates()
    }
  }

  function openPage(name?: string) {
    void openPackagePage(name).catch((error) => setError(errorText(error)))
  }

  return {
    mode,
    packageCount: packages.length,
    changeMode,
    mobileDetail,
    toast: { message: toastMessage, changed: changed && !batchFeedback, busy, running, reload },
    feedback: {
      error,
      notice: batchFeedback ? notice : '',
      changed: changed && batchFeedback,
      removing,
      busy,
      running,
      retryOperation,
      reload,
      reloadFailed: failedOperation?.action === 'reload',
    },
    library: {
      packages,
      mode,
      query,
      search,
      sort,
      category,
      page,
      loading,
      error,
      items,
      item,
      catalog,
      info,
      updateInfo,
      checkErrors,
      batchStates,
      busy,
      path,
      hasNext: Boolean(catalogResult?.hasNext),
      changeQuery,
      clearQuery: () => setQuery(''),
      changeSort,
      changeCategory,
      selectPackage,
      changePage,
      openPage,
      updates: {
        checking,
        busy,
        path,
        running,
        batchDone,
        batchStates,
        updates,
        checked: checked?.source === infoSource,
        checkErrors,
        unknown,
        checkSummary,
        batchSummary,
        checkUpdates,
        updateAll,
      },
    },
    detail: {
      item,
      loading,
      mobileDetail,
      name,
      detail,
      installed,
      updateAvailable,
      pinned,
      checkErrors,
      batchStates,
      busy,
      running,
      path,
      changed,
      perform,
      openPage,
      backToList: () => setMobileDetail(false),
      requestRemove: (target: ExtensionPackage) => {
        setError('')
        setRemoving(target)
      },
    },
    removeDialog: {
      removing,
      busy,
      running,
      error,
      close: () => setRemoving(null),
      confirm: () => {
        if (removing) void perform('remove', removing)
      },
    },
  }
}

export type ExtensionPackagesController = ReturnType<typeof useExtensionPackages>
