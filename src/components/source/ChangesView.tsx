import { Button } from '@heroui/react'
import { GitBranch, GitCommitHorizontal } from 'lucide-react'
import { type ReactNode } from 'react'
import type { DiffLine } from '../../types'
import { HoverScrollArea } from '../HoverScrollArea'
import { OverflowTooltip } from '../OverflowTooltip'
import { CommitBranchDialog } from './CommitBranchDialog'
import { FileDiff } from './FileDiff'
import { GitChangesReview } from './GitChangesReview'
import { GitChangesToolbar } from './GitChangesToolbar'
import { GitFileNavigator, GitQuickFind } from './GitFileNavigator'
import { LoadedDiff } from './LoadedDiff'
import { SourceBrowser } from './SourceBrowser'
import { SourceNotice } from './SourceNotice'
import { useChangesPane } from './useChangesPane'

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
  const {
    contentNotice,
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
  } = useChangesPane({
    initialPath,
    fallback,
    requestNonce,
    tick,
    workspace,
    onSelectionChange,
    navigation,
    navigationTabs,
  })

  if (!status.data || contentNotice) return contentNotice

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
            <GitChangesToolbar
              layoutRef={layoutRef}
              t={t}
              navigationCollapsed={navigationCollapsed}
              setNavigationCollapsed={setNavigationCollapsed}
              path={path}
              fallbackLabel={fallbackLabel}
              file={file}
              layout={layout}
              toggleLayout={toggleLayout}
              openFile={openFile}
              basic={basic}
              restoring={restoring}
              confirmRestore={confirmRestore}
            />
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
