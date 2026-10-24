import type * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitRestoreFile, gitStatus } from '../../lib/source/api'
import { orderFilesByTree } from '../../lib/source/fileTree'
import { navigateToPage } from '../../router/navigation'
import { useSource } from './context'
import { useGitOperationPending } from './GitOperationContext'
import { useGitRepositoryStatus } from './GitRepositoryStatus'
import { GitWorkspaceLoading } from './GitWorkspaceSkeleton'
import { SourceNotice } from './SourceNotice'
import { useDiffLayout } from './useDiffLayout'
import { useProjectSource } from './useProjectSource'
import { useSourceQuery } from './useSourceQuery'

export function useChangesPane({
  initialPath,
  fallback,
  requestNonce,
  tick,
  workspace,
  onSelectionChange,
  navigation,
  navigationTabs,
}: {
  initialPath: string | null
  fallback: import('../../types').DiffLine[] | undefined
  requestNonce: number
  tick: number
  workspace: boolean
  onSelectionChange: ((path: string | null) => void) | undefined
  navigation: ((count?: number | undefined) => React.ReactNode) | undefined
  navigationTabs: React.ReactNode
}) {
  const t = useT()
  const source = useSource()
  const { path: projectPath, revision, agent } = useProjectSource()
  const [quickFind, setQuickFind] = useState(false)
  const [selected, setSelected] = useState(initialPath)
  const [jump, setJump] = useState({ path: initialPath, nonce: 0 })
  const [commitOpen, setCommitOpen] = useState(false)
  const [navigationCollapsed, setNavigationCollapsed] = useState(false)
  const [confirmPath, setConfirmPath] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<{ path: string; message: string } | null>(null)
  const [localTick, setLocalTick] = useState(0)
  const [showFallback, setShowFallback] = useState(!initialPath && Boolean(fallback?.length))
  const [handledRequest, setHandledRequest] = useState(requestNonce)
  if (handledRequest !== requestNonce) {
    setHandledRequest(requestNonce)
    if (initialPath) {
      setSelected(initialPath)
      setJump((value) => ({ path: initialPath, nonce: value.nonce + 1 }))
    }
    setShowFallback(!initialPath && Boolean(fallback?.length))
    setConfirmPath(null)
    setRestoreError(null)
  }
  const operationPending = useGitOperationPending()
  const repository = useGitRepositoryStatus()
  const ownStatus = useSourceQuery(
    !repository && projectPath ? `status:${projectPath}` : null,
    () => gitStatus(projectPath),
    `${revision}:${tick}:${localTick}`,
  )
  const status = repository?.status ?? ownStatus
  function refreshStatus() {
    setLocalTick((value) => value + 1)
    repository?.refresh()
  }
  const files = useMemo(() => {
    const files = status.data?.repo ? status.data.files : []
    return workspace ? orderFilesByTree(files) : files
  }, [status.data, workspace])
  const path = selected ?? files[0]?.path ?? null
  useEffect(() => {
    onSelectionChange?.(path)
  }, [onSelectionChange, path])
  const file = files.find((item) => item.path === path)
  const treeFiles =
    path && !file ? [...files, { path, code: '', staged: false, unstaged: false }] : files
  const { ref: layoutRef, layout, setLayout } = useDiffLayout()
  useEffect(() => {
    if (!workspace) return
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setQuickFind(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [workspace])
  function choose(next: string) {
    setSelected(next)
    setJump((value) => ({ path: next, nonce: value.nonce + 1 }))
    setShowFallback(false)
    setConfirmPath(null)
    setRestoreError(null)
  }
  function toggleLayout() {
    setLayout(layout === 'split' ? 'unified' : 'split')
  }
  function openFile() {
    if (path) {
      source?.show({ tab: 'files', path, mode: 'view', projectPath })
      if (workspace) void navigateToPage('chat')
    }
  }
  function confirmRestore() {
    setRestoreError(null)
    setConfirmPath(path)
  }
  async function restore(target: string) {
    setRestoring(true)
    setRestoreError(null)
    try {
      await gitRestoreFile(projectPath, target)
      setConfirmPath(null)
      setSelected((current) => (current === target ? null : current))
      refreshStatus()
    } catch (error) {
      setRestoreError({
        path: target,
        message: error instanceof Error ? error.message : t('source.missingDiff'),
      })
    } finally {
      setRestoring(false)
    }
  }
  function notice(kind: 'empty' | 'loading' | 'error', text: string) {
    return workspace ? (
      <div className="git-workspace-notice">
        <aside>
          {navigation?.()}
          <div className="git-navigation-surface">{navigationTabs}</div>
        </aside>
        <div className="git-review-surface">
          <SourceNotice kind={kind} text={text} />
        </div>
      </div>
    ) : (
      <div className="source-changes">
        <SourceNotice kind={kind} text={text} />
      </div>
    )
  }
  function getNotice() {
    if (!projectPath) return notice('empty', t('source.noProject'))
    if (status.loading && !status.data)
      return workspace ? (
        <GitWorkspaceLoading navigation={navigation?.()} navigationTabs={navigationTabs} />
      ) : (
        notice('loading', t('source.loading'))
      )
    if (status.error || !status.data)
      return notice('error', status.error || t('source.missingDiff'))
    if (!status.data.available) return notice('empty', t('source.gitMissing'))
    if (!status.data.repo) return notice('empty', t('source.notRepository'))
    return null
  }
  return {
    contentNotice: getNotice(),
    t,
    projectPath,
    revision,
    agent,
    quickFind,
    setQuickFind,
    setSelected,
    jump,
    commitOpen,
    setCommitOpen,
    navigationCollapsed,
    setNavigationCollapsed,
    confirmPath,
    setConfirmPath,
    restoring,
    restoreError,
    localTick,
    showFallback,
    setShowFallback,
    operationPending,
    status,
    refreshStatus,
    files,
    path,
    file,
    treeFiles,
    layoutRef,
    layout,
    choose,
    toggleLayout,
    openFile,
    confirmRestore,
    restore,
  }
}
