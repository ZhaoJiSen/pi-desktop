import { Button, Chip } from '@heroui/react'
import { SourceAction } from './SourceAction'
import { Columns2, FileSymlink, GitBranch, GitCommitHorizontal, Rows3, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitRestoreFile, gitStatus } from '../../lib/source/api'
import type { DiffLine } from '../../types'
import { HoverScrollArea } from '../HoverScrollArea'
import { CommitBranchDialog } from './CommitBranchDialog'
import { useSource } from './context'
import { FileDiff } from './FileDiff'
import { FilePathTree } from './FilePathTree'
import { LoadedDiff } from './LoadedDiff'
import { SourceBrowser } from './SourceBrowser'
import { SourceNotice } from './SourceNotice'
import { useProjectSource } from './useProjectSource'
import { useDiffLayout } from './useDiffLayout'
import { useSourceQuery } from './useSourceQuery'

export function ChangesPane({
  tick,
  requestNonce,
  initialPath,
  fallback,
  fallbackLabel,
}: {
  tick: number
  requestNonce: number
  initialPath: string | null
  fallback?: DiffLine[]
  fallbackLabel: string
}) {
  const t = useT()
  const source = useSource()
  const { path: projectPath, revision, agent } = useProjectSource()
  const [selected, setSelected] = useState(initialPath)
  const [commitOpen, setCommitOpen] = useState(false)
  const [confirmPath, setConfirmPath] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<{ path: string; message: string } | null>(null)
  const [localTick, setLocalTick] = useState(0)
  const [showFallback, setShowFallback] = useState(!initialPath && Boolean(fallback?.length))
  const [handledRequest, setHandledRequest] = useState(requestNonce)
  if (handledRequest !== requestNonce) {
    setHandledRequest(requestNonce)
    if (initialPath) setSelected(initialPath)
    setShowFallback(!initialPath && Boolean(fallback?.length))
    setConfirmPath(null)
    setRestoreError(null)
  }
  const status = useSourceQuery(
    projectPath ? `status:${projectPath}` : null,
    () => gitStatus(projectPath),
    `${revision}:${tick}:${localTick}`,
  )
  const files = status.data?.repo ? status.data.files : []
  const path = selected ?? files[0]?.path ?? null
  const file = files.find((item) => item.path === path)
  const treeFiles =
    path && !file ? [...files, { path, code: '', staged: false, unstaged: false }] : files
  const { ref: layoutRef, layout, setLayout } = useDiffLayout()
  function choose(next: string) {
    setSelected(next)
    setShowFallback(false)
    setConfirmPath(null)
    setRestoreError(null)
  }
  async function restore(target: string) {
    setRestoring(true)
    setRestoreError(null)
    try {
      await gitRestoreFile(projectPath, target)
      setConfirmPath(null)
      setSelected((current) => (current === target ? null : current))
      setLocalTick((value) => value + 1)
    } catch (error) {
      setRestoreError({
        path: target,
        message: error instanceof Error ? error.message : t('source.missingDiff'),
      })
    } finally {
      setRestoring(false)
    }
  }
  if (!projectPath) return <SourceNotice kind="empty" text={t('source.noProject')} />
  if (status.loading && !status.data)
    return <SourceNotice kind="loading" text={t('source.loading')} />
  if (status.error || !status.data)
    return <SourceNotice kind="error" text={status.error || t('source.missingDiff')} />
  if (!status.data.available) return <SourceNotice kind="empty" text={t('source.gitMissing')} />
  if (!status.data.repo) return <SourceNotice kind="empty" text={t('source.notRepository')} />
  return (
    <div className="source-changes">
      <div className="source-branch">
        <span className="source-branch-info">
          <GitBranch aria-hidden="true" />
          <span className="source-branch-name" title={status.data.branch || t('source.changes')}>
            {status.data.branch || t('source.changes')}
          </span>
          <Chip
            size="sm"
            variant="secondary"
            className="source-count"
            aria-label={t('source.commitMany', { count: files.length })}
          >
            {files.length}
          </Chip>
        </span>
        <Button
          variant="secondary"
          className="source-commit"
          isDisabled={!files.length}
          onPress={() => setCommitOpen(true)}
        >
          <GitCommitHorizontal aria-hidden="true" />
          {t('source.commitBranch')}
        </Button>
      </div>
      <CommitBranchDialog
        open={commitOpen}
        projectPath={projectPath}
        fromBranch={status.data.branch ?? undefined}
        files={files.map((item) => item.path)}
        onClose={() => setCommitOpen(false)}
        onCommitted={() => {
          setSelected(null)
          setShowFallback(false)
          setLocalTick((value) => value + 1)
        }}
      />
      <SourceBrowser
        navigation={
          <>
            <div className="source-nav-heading">{t('source.changedFiles')}</div>
            <HoverScrollArea
              shadowSize={0}
              className="source-tree-scroll"
              label={t('source.changedFiles')}
            >
              {treeFiles.length ? (
                <FilePathTree
                  files={treeFiles}
                  selected={path}
                  agent={agent}
                  onSelect={choose}
                  revealKey={requestNonce}
                />
              ) : (
                <SourceNotice kind="empty" text={t('source.emptyChanges')} />
              )}
              {status.data.truncated && <p className="source-note">{t('source.truncatedList')}</p>}
            </HoverScrollArea>
          </>
        }
      >
        {path || showFallback ? (
          <>
            <div className="source-detail-bar source-preview-bar" ref={layoutRef}>
              <span className="source-detail-path" title={path ?? fallbackLabel}>
                {path ?? fallbackLabel}
              </span>
              {file && (
                <span className="diff-stats">
                  <span className="positive">+{file.additions ?? 0}</span>
                  <span className="negative">−{file.deletions ?? 0}</span>
                </span>
              )}
              <SourceAction
                label={layout === 'split' ? t('source.unified') : t('source.split')}
                pressed={layout === 'split'}
                onPress={() => setLayout(layout === 'split' ? 'unified' : 'split')}
              >
                {layout === 'split' ? <Columns2 /> : <Rows3 />}
              </SourceAction>
              {path && (
                <SourceAction
                  label={t('source.openFile')}
                  onPress={() => source?.show({ tab: 'files', path, mode: 'view' })}
                >
                  <FileSymlink />
                </SourceAction>
              )}
              {file && file.code !== '?' && (
                <SourceAction
                  label={t('source.restore')}
                  isDisabled={restoring}
                  onPress={() => {
                    setRestoreError(null)
                    setConfirmPath(path)
                  }}
                >
                  <Undo2 />
                </SourceAction>
              )}
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
