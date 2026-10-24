import { clearPackageBatch, runPackageBatch } from '../../lib/packageBatch'
import { packageName } from '../../lib/packages'
import { clearCompletedPackageUpdates, packageKey as keyOf } from '../../lib/packageUpdates'
import { errorText } from '../../lib/utils'
import { useWorkspace } from '../../store/workspace'
import type { ExtensionPackage } from '../../types'
import type { usePackageState } from './usePackageState'

export function createPackageActions({
  active,
  setBusy,
  connectSession,
  setChanged,
  setNotice,
  setToastMessage,
  t,
  setFailedOperation,
  setError,
  batchForAnotherPath,
  operation,
  batchForThisPath,
  checking,
  running,
  path,
  updateTargets,
  managePackage,
  refreshExtensionPackages,
  canReloadBatch,
  setInfoCache,
  setCheckRetry,
  setBatchFeedback,
  setBatchStates,
  setBatchSummary,
  setRemoving,
  busy,
}: Pick<
  ReturnType<typeof usePackageState>,
  | 'active'
  | 'setBusy'
  | 'setChanged'
  | 'setNotice'
  | 'setToastMessage'
  | 't'
  | 'setFailedOperation'
  | 'setError'
  | 'operation'
  | 'checking'
  | 'running'
  | 'path'
  | 'updateTargets'
  | 'setInfoCache'
  | 'setCheckRetry'
  | 'setBatchFeedback'
  | 'setBatchStates'
  | 'setBatchSummary'
  | 'setRemoving'
  | 'busy'
> & {
  connectSession: (sessionId: string, force?: boolean) => Promise<void>
  batchForAnotherPath: () => boolean
  batchForThisPath: () => boolean
  managePackage: (
    action: 'install' | 'update' | 'remove' | 'enable' | 'disable',
    item: import('../../types').ExtensionPackage,
    path: string,
  ) => Promise<void>
  refreshExtensionPackages: (path: string) => Promise<import('../../types').ExtensionPackage[]>
  canReloadBatch: (sessionId: string | null) => boolean
}) {
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
  return { perform, reload, updateAll }
}
