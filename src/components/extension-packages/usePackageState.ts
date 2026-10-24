import { useDebounce } from 'ahooks'
import { useCallback, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { getPackageBatch } from '../../lib/packageBatch'
import { hasUpdate, npmName, type CatalogOptions, type PackageInfo } from '../../lib/packages'
import {
  packageKey as keyOf,
  metadataSource,
  summarizePackageCheck,
  updatablePackages,
  type PackageUpdateState,
  type UpdateCheck,
} from '../../lib/packageUpdates'
import { useWorkspace } from '../../store/workspace'
import type { ExtensionPackage } from '../../types'

const emptyInfo: Record<string, PackageInfo> = {}

export function usePackageState() {
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
  const consumeCheckRevision = useCallback((revision: number) => {
    const force = revision > forcedCheckRevision.current
    forcedCheckRevision.current = revision
    return force
  }, [])

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
  return {
    packages,
    active,
    path,
    running,
    mode,
    setMode,
    query,
    setQuery,
    sort,
    setSort,
    category,
    setCategory,
    page,
    setPage,
    search,
    mobileDetail,
    setMobileDetail,
    setSelected,
    catalogResult,
    setCatalogResult,
    catalog,
    infoSource,
    setInfoCache,
    info,
    checked,
    setChecked,
    updateInfo,
    checkErrors,
    setChecking,
    checkRetry,
    setCheckRetry,
    consumeCheckRevision,
    batchStates,
    setBatchStates,
    batchSummary,
    setBatchSummary,
    operation,
    busy,
    setBusy,
    checking,
    error,
    setError,
    failedOperation,
    setFailedOperation,
    notice,
    setNotice,
    changed,
    setChanged,
    batchFeedback,
    setBatchFeedback,
    toastMessage,
    setToastMessage,
    removing,
    setRemoving,
    retry,
    setRetry,
    catalogKey,
    loading,
    t,
    items,
    item,
    name,
    detail,
    installed,
    updateAvailable,
    pinned,
    updateTargets,
    updates,
    checkSummary,
    unknown,
    batchDone,
  }
}
