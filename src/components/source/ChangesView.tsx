import { Button, Dropdown } from '@heroui/react'
import { SourceAction } from './SourceAction'
import {
  Columns2,
  Ellipsis,
  FileSymlink,
  GitBranch,
  GitCommitHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Rows3,
  Undo2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { navigateToPage } from '../../router/navigation'
import { OverflowTooltip } from '../OverflowTooltip'
import { useT } from '../../lib/i18n'
import { gitRestoreFile, gitStatus } from '../../lib/source/api'
import { orderFilesByTree } from '../../lib/source/fileTree'
import type { DiffLine } from '../../types'
import { HoverScrollArea } from '../HoverScrollArea'
import { CommitBranchDialog } from './CommitBranchDialog'
import { useSource } from './context'
import { FileDiff } from './FileDiff'
import { GitFileNavigator, GitQuickFind } from './GitFileNavigator'
import { GitChangesReview } from './GitChangesReview'
import { LoadedDiff } from './LoadedDiff'
import { SourceBrowser } from './SourceBrowser'
import { SourceFilePath } from './SourceFilePath'
import { SourceNotice } from './SourceNotice'
import { GitWorkspaceLoading } from './GitWorkspaceSkeleton'
import { useProjectSource } from './useProjectSource'
import { useDiffLayout } from './useDiffLayout'
import { useSourceQuery } from './useSourceQuery'
import { useGitRepositoryStatus } from './GitRepositoryStatus'
import { useGitOperationPending } from './GitOperationContext'

export function ChangesPane({
  navigation,
  navigationTabs,
  tick,
  requestNonce,
  initialPath,
  fallback,
  fallbackLabel,
  workspace = false,
  basic = false,
  onSelectionChange,
}: {
  workspace?: boolean
  basic?: boolean
  onSelectionChange?: (path: string | null) => void
  navigation?: (count?: number) => ReactNode
  navigationTabs?: ReactNode
  tick: number
  requestNonce: number
  initialPath: string | null
  fallback?: DiffLine[]
  fallbackLabel: string
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
  if (!projectPath) return notice('empty', t('source.noProject'))
  if (status.loading && !status.data)
    return workspace ? (
      <GitWorkspaceLoading navigation={navigation?.()} navigationTabs={navigationTabs} />
    ) : (
      notice('loading', t('source.loading'))
    )
  if (status.error || !status.data) return notice('error', status.error || t('source.missingDiff'))
  if (!status.data.available) return notice('empty', t('source.gitMissing'))
  if (!status.data.repo) return notice('empty', t('source.notRepository'))
  return (
    <div className={workspace ? 'source-changes git-changes-workspace' : 'source-changes'}>
      <div className="source-git-context" hidden={workspace}>
        {!workspace && navigation?.(files.length)}
        <span className="source-branch-info">
          <GitBranch aria-hidden="true" />
          <OverflowTooltip
            className="source-branch-name"
            text={status.data.branch || t('source.changes')}
          />
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="source-commit"
          isDisabled={!files.length || operationPending || files.some((file) => file.code === 'U')}
          hidden={basic || workspace}
          onPress={() => setCommitOpen(true)}
        >
          <GitCommitHorizontal aria-hidden="true" />
          {t('source.commitBranch')}
        </Button>
      </div>
      {quickFind && (
        <GitQuickFind
          files={files}
          selected={path}
          onSelect={choose}
          onClose={() => setQuickFind(false)}
        />
      )}
      <CommitBranchDialog
        open={commitOpen}
        projectPath={projectPath}
        fromBranch={status.data.branch ?? undefined}
        files={files.map((item) => item.path)}
        onClose={() => setCommitOpen(false)}
        onCommitted={() => {
          setSelected(null)
          setShowFallback(false)
          refreshStatus()
        }}
      />
      <SourceBrowser
        resizable={workspace}
        navigationCollapsed={Boolean(path || showFallback) && navigationCollapsed}
        navigation={
          <GitFileNavigator
            persistView
            files={treeFiles}
            revealKey={requestNonce}
            selected={path}
            onSelect={choose}
            basic={basic}
            notice={
              status.data.truncated ? (
                <p className="source-note">{t('source.truncatedList')}</p>
              ) : undefined
            }
            agent={agent}
            heading={workspace ? <>{navigation?.(files.length)}</> : undefined}
            onQuickOpen={workspace ? () => setQuickFind(true) : undefined}
            compactSearch={workspace}
            navigationHeader={navigationTabs}
            footer={
              workspace ? (
                <>
                  <Button
                    variant="secondary"
                    className="git-commit-button"
                    isDisabled={
                      !files.length || operationPending || files.some((file) => file.code === 'U')
                    }
                    onPress={() => setCommitOpen(true)}
                  >
                    <GitCommitHorizontal />
                    {t('source.commitBranch')}
                  </Button>
                </>
              ) : undefined
            }
          />
        }
      >
        {workspace ? (
          <GitChangesReview
            files={treeFiles}
            projectPath={projectPath}
            tick={tick + localTick + revision}
            jump={jump}
            onActiveChange={setSelected}
            onRestored={(target) => {
              setSelected((current) => (current === target ? null : current))
              refreshStatus()
            }}
            fallback={
              fallback?.length ? { path: initialPath ?? fallbackLabel, lines: fallback } : undefined
            }
          />
        ) : path || showFallback ? (
          <>
            <div className="source-detail-bar source-preview-bar" ref={layoutRef}>
              <SourceAction
                label={t(
                  navigationCollapsed ? 'source.showChangedFiles' : 'source.hideChangedFiles',
                )}
                pressed={!navigationCollapsed}
                onPress={() => setNavigationCollapsed((value) => !value)}
              >
                {navigationCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </SourceAction>
              <div className="source-preview-identity">
                <SourceFilePath path={path ?? fallbackLabel} />
                {file && (
                  <span className="diff-stats">
                    <span className="positive">+{file.additions ?? 0}</span>
                    <span className="negative">−{file.deletions ?? 0}</span>
                  </span>
                )}
              </div>
              <span className="source-preview-inline-actions">
                <SourceAction
                  label={layout === 'split' ? t('source.unified') : t('source.split')}
                  pressed={layout === 'split'}
                  onPress={toggleLayout}
                >
                  {layout === 'split' ? <Columns2 /> : <Rows3 />}
                </SourceAction>
                <span className="source-preview-file-actions">
                  {path && (
                    <SourceAction label={t('source.openFile')} onPress={openFile}>
                      <FileSymlink />
                    </SourceAction>
                  )}
                  {!basic && file && file.code !== '?' && (
                    <SourceAction
                      label={t('source.restore')}
                      isDisabled={restoring}
                      onPress={confirmRestore}
                    >
                      <Undo2 />
                    </SourceAction>
                  )}
                </span>
              </span>
              <Dropdown>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="source-action source-preview-overflow"
                  aria-label={t('source.fileActions')}
                >
                  <Ellipsis />
                </Button>
                <Dropdown.Popover placement="bottom end" className="action-popover" offset={6}>
                  <Dropdown.Menu
                    aria-label={t('source.fileActions')}
                    onAction={(key) => {
                      if (key === 'layout') toggleLayout()
                      else if (key === 'open') openFile()
                      else if (key === 'restore') confirmRestore()
                    }}
                  >
                    <Dropdown.Item
                      id="layout"
                      className="menu-row"
                      textValue={layout === 'split' ? t('source.unified') : t('source.split')}
                    >
                      {layout === 'split' ? <Rows3 /> : <Columns2 />}
                      {layout === 'split' ? t('source.unified') : t('source.split')}
                    </Dropdown.Item>
                    {path && (
                      <Dropdown.Item
                        id="open"
                        className="menu-row"
                        textValue={t('source.openFile')}
                      >
                        <FileSymlink />
                        {t('source.openFile')}
                      </Dropdown.Item>
                    )}
                    {!basic && file && file.code !== '?' && (
                      <Dropdown.Item
                        id="restore"
                        className="menu-row source-discard-action"
                        textValue={t('source.restore')}
                        isDisabled={restoring}
                      >
                        <Undo2 />
                        {t('source.restore')}
                      </Dropdown.Item>
                    )}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
            {confirmPath === path && path && (
              <div className="source-restore">
                <p>{t('source.restoreConfirm')}</p>
                <span className="source-restore-actions">
                  <Button
                    size="sm"
                    variant="danger"
                    isPending={restoring}
                    onPress={() => void restore(path)}
                  >
                    {t('source.restore')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={restoring}
                    onPress={() => setConfirmPath(null)}
                  >
                    {t('common.cancel')}
                  </Button>
                </span>
              </div>
            )}
            {restoreError?.path === path && (
              <p className="source-note" role="alert">
                {restoreError?.message}
              </p>
            )}
            <HoverScrollArea
              className="source-preview-scroll"
              viewportClassName="source-scroll"
              label={path ?? fallbackLabel}
            >
              {showFallback && fallback?.length ? (
                <FileDiff
                  path={fallbackLabel || 'diff'}
                  text=""
                  binary={false}
                  truncated={false}
                  missing
                  embedded
                  layout={layout}
                  fallback={fallback}
                />
              ) : (
                path && (
                  <LoadedDiff
                    projectPath={projectPath}
                    path={path}
                    tick={tick + localTick}
                    embedded
                    layout={layout}
                    fallback={path === initialPath ? fallback : undefined}
                  />
                )
              )}
            </HoverScrollArea>
          </>
        ) : (
          <SourceNotice kind="empty" text={t('source.emptyChanges')} />
        )}
      </SourceBrowser>
    </div>
  )
}
