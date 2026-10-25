import type * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import { orderFilesByTree } from '../../lib/source/fileTree'
import { useGitOperationPending } from './GitOperationContext'
import { useGitRepositoryStatus } from './GitRepositoryStatus'
import { GitWorkspaceLoading } from './GitWorkspaceSkeleton'
import { SourceNotice } from './SourceNotice'
import { useProjectSource } from './useProjectSource'
import { useGitStatus } from './useGitStatus'

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
  const { path: projectPath, revision, agent } = useProjectSource()
  const [quickFind, setQuickFind] = useState(false)
  const [selected, setSelected] = useState(initialPath)
  const [jump, setJump] = useState({ path: initialPath, nonce: 0 })
  const [commitOpen, setCommitOpen] = useState(false)
  const [navigationCollapsed, setNavigationCollapsed] = useState(false)
  const [localTick, setLocalTick] = useState(0)
  const [showFallback, setShowFallback] = useState(!initialPath && Boolean(fallback?.length))
  const [handledRequest, setHandledRequest] = useState(requestNonce)
  if (handledRequest !== requestNonce) {
    setHandledRequest(requestNonce)
    if (initialPath) {
      setSelected(initialPath)
      if (workspace || selected !== initialPath)
        setJump((value) => ({ path: initialPath, nonce: value.nonce + 1 }))
    }
    setShowFallback(!initialPath && Boolean(fallback?.length))
  }
  const operationPending = useGitOperationPending()
  const repository = useGitRepositoryStatus()
  const ownStatus = useGitStatus(
    !repository && projectPath ? projectPath : null,
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
  const requestedFallback = Boolean(fallback?.length && selected === initialPath && initialPath)
  const path =
    files.some((file) => file.path === selected) || requestedFallback
      ? selected
      : (files[0]?.path ?? null)
  useEffect(() => {
    onSelectionChange?.(path)
  }, [onSelectionChange, path])
  const file = files.find((item) => item.path === path)
  const treeFiles =
    path && !file ? [...files, { path, code: '', staged: false, unstaged: false }] : files
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
    statusRevision: repository?.revision ?? ownStatus.revision,
    agent,
    quickFind,
    setQuickFind,
    setSelected,
    jump,
    commitOpen,
    setCommitOpen,
    navigationCollapsed,
    setNavigationCollapsed,
    localTick,
    showFallback,
    setShowFallback,
    operationPending,
    status,
    refreshStatus,
    files,
    path,
    treeFiles,
    choose,
  }
}
