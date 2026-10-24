import { clearPackageBatch } from '../../lib/packageBatch'
import { openPackagePage } from '../../lib/packages'
import { packageKey as keyOf } from '../../lib/packageUpdates'
import { errorText } from '../../lib/utils'
import type { ExtensionPackage } from '../../types'
import type { usePackageState } from './usePackageState'

export function createPackageNavigation({
  mode,
  path,
  setMode,
  setSelected,
  setMobileDetail,
  setQuery,
  setError,
  setNotice,
  setChanged,
  setBatchFeedback,
  setPage,
  sort,
  setSort,
  category,
  setCategory,
  setFailedOperation,
  failedOperation,
  reload,
  perform,
  setRetry,
  checkUpdates,
}: Pick<
  ReturnType<typeof usePackageState>,
  | 'mode'
  | 'path'
  | 'setMode'
  | 'setSelected'
  | 'setMobileDetail'
  | 'setQuery'
  | 'setError'
  | 'setNotice'
  | 'setChanged'
  | 'setBatchFeedback'
  | 'setPage'
  | 'sort'
  | 'setSort'
  | 'category'
  | 'setCategory'
  | 'setFailedOperation'
  | 'failedOperation'
  | 'setRetry'
> & {
  reload: () => Promise<void>
  perform: (
    action: 'install' | 'update' | 'remove' | 'enable' | 'disable',
    target: import('../../types').ExtensionPackage,
  ) => Promise<void>
  checkUpdates: () => Promise<void>
}) {
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
    changeMode,
    changeQuery,
    changeSort,
    changeCategory,
    selectPackage,
    changePage,
    retryOperation,
    openPage,
  }
}
