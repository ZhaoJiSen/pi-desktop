import { useContext } from 'react'
import { clearPackageBatch, getPackageBatch, isPackageBatchRunning } from '../../lib/packageBatch'
import { errorText } from '../../lib/utils'
import { useWorkspace } from '../../store/workspace'
import type { ExtensionPackage } from '../../types'
import { createPackageActions } from './packageActions'
import { createPackageNavigation } from './packageNavigation'
import { PackageServices } from './services'
import { usePackageMetadata } from './usePackageMetadata'
import { usePackageState } from './usePackageState'

export function useExtensionPackages() {
  const { browsePackages, packageInfo, managePackage, refreshExtensionPackages, connectSession } =
    useContext(PackageServices)
  const state = usePackageState()
  const {
    packages,
    path,
    running,
    mode,
    query,
    setQuery,
    sort,
    category,
    page,
    search,
    mobileDetail,
    setMobileDetail,
    catalogResult,
    catalog,
    infoSource,
    info,
    checked,
    updateInfo,
    checkErrors,
    setChecking,
    setCheckRetry,
    batchStates,
    batchSummary,
    operation,
    busy,
    checking,
    error,
    setError,
    failedOperation,
    setFailedOperation,
    notice,
    changed,
    batchFeedback,
    toastMessage,
    removing,
    setRemoving,
    loading,
    items,
    item,
    name,
    detail,
    installed,
    updateAvailable,
    pinned,
    updates,
    checkSummary,
    unknown,
    batchDone,
  } = state

  usePackageMetadata({ ...state, browsePackages, packageInfo })

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
  const { perform, reload, updateAll } = createPackageActions({
    ...state,
    connectSession,
    batchForAnotherPath,
    batchForThisPath,
    managePackage,
    refreshExtensionPackages,
    canReloadBatch,
  })
  const {
    changeMode,
    changeQuery,
    changeSort,
    changeCategory,
    selectPackage,
    changePage,
    retryOperation,
    openPage,
  } = createPackageNavigation({ ...state, reload, perform, checkUpdates })

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
