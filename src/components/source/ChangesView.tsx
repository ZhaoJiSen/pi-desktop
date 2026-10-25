import { Button } from '@heroui/react'
import { GitBranch, GitCommitHorizontal, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { type ReactNode } from 'react'
import type { DiffLine } from '../../types'
import { OverflowTooltip } from '../OverflowTooltip'
import { CommitBranchDialog } from './CommitBranchDialog'
import { GitChangesReview } from './GitChangesReview'
import { GitFileNavigator, GitQuickFind } from './GitFileNavigator'
import { SourceBrowser } from './SourceBrowser'
import { SourceAction } from './SourceAction'
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
    statusRevision,
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
        onChanged={refreshStatus}
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
        <GitChangesReview
          files={treeFiles}
          previewPath={workspace ? undefined : path}
          readOnly={basic}
          navigationAction={
            basic ? (
              <SourceAction
                label={t(
                  navigationCollapsed ? 'source.showChangedFiles' : 'source.hideChangedFiles',
                )}
                onPress={() => setNavigationCollapsed((value) => !value)}
              >
                {navigationCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </SourceAction>
            ) : undefined
          }
          projectPath={projectPath}
          tick={JSON.stringify([tick, localTick, revision, statusRevision])}
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
      </SourceBrowser>
    </div>
  )
}
