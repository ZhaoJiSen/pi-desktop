import { Accordion, Button, Chip, Tooltip } from '@heroui/react'
import { Columns2, FileSymlink, GitBranch, GitCommitHorizontal, Rows3, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useT } from '../../lib/i18n'
import { fileIconUrl } from '../../lib/source/fileIcon'
import { gitRestoreFile, gitStatus } from '../../lib/source/api'
import { pathTouched } from '../../lib/source/paths'
import type { DiffLine } from '../../types'
import type { GitFileStatus } from '../../lib/source/types'
import { CommitBranchDialog } from './CommitBranchDialog'
import { useSource } from './context'
import { FileDiff } from './FileDiff'
import { LoadedDiff } from './LoadedDiff'
import { SourceNotice } from './SourceNotice'
import { useProjectSource } from './useProjectSource'
import { useDiffLayout } from './useDiffLayout'
import { useSourceQuery } from './useSourceQuery'

function IconTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip delay={450}>
      <Tooltip.Trigger role="presentation" tabIndex={-1}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content placement="top" offset={6}>
        {label}
      </Tooltip.Content>
    </Tooltip>
  )
}

function SourceFileIcon({ path }: { path: string }) {
  const src = fileIconUrl(path)
  if (!src) return null
  return (
    <span className="source-type-icon" aria-hidden="true">
      <img src={src} alt="" />
    </span>
  )
}

export function ChangesPane({
  tick,
  initialPath,
  fallback,
  fallbackLabel,
}: {
  tick: number
  initialPath: string | null
  fallback?: DiffLine[]
  fallbackLabel: string
}) {
  const t = useT()
  const source = useSource()
  const { path: projectPath, revision, agent } = useProjectSource()
  const [openPaths, setOpenPaths] = useState<Set<string>>(
    () => new Set(initialPath ? [initialPath] : []),
  )
  const { ref: layoutRef, layout, setLayout } = useDiffLayout()
  const [commitOpen, setCommitOpen] = useState(false)
  const [confirmPath, setConfirmPath] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState('')
  const [localTick, setLocalTick] = useState(0)
  const [showFallback, setShowFallback] = useState(!initialPath && Boolean(fallback?.length))
  const status = useSourceQuery(
    projectPath ? `status:${projectPath}` : null,
    () => gitStatus(projectPath),
    `${revision}:${tick}:${localTick}`,
  )
  const files = status.data && status.data.repo ? status.data.files : []
  async function restore(path: string) {
    setRestoreError('')
    try {
      await gitRestoreFile(projectPath, path)
      setConfirmPath(null)
      setOpenPaths((current) => {
        if (!current.has(path)) return current
        const next = new Set(current)
        next.delete(path)
        return next
      })
      setLocalTick((value) => value + 1)
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : t('source.missingDiff'))
    }
  }
  if (!projectPath) return <SourceNotice kind="empty" text={t('source.noProject')} />
  if (status.loading && !status.data)
    return <SourceNotice kind="loading" text={t('source.loading')} />
  if (status.error || !status.data) {
    return <SourceNotice kind="error" text={status.error || t('source.missingDiff')} />
  }
  if (!status.data.available) return <SourceNotice kind="empty" text={t('source.gitMissing')} />
  if (!status.data.repo) return <SourceNotice kind="empty" text={t('source.notRepository')} />
  if (!status.data.files.length && !showFallback) {
    return <SourceNotice kind="empty" text={t('source.emptyChanges')} />
  }
  return (
    <div className="source-changes" ref={layoutRef}>
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
        <span className="source-branch-actions">
          <IconTip label={layout === 'split' ? t('source.unified') : t('source.split')}>
            <Button
              isIconOnly
              variant="ghost"
              className="icon-button source-diff-layout"
              aria-label={layout === 'split' ? t('source.unified') : t('source.split')}
              aria-pressed={layout === 'split'}
              onPress={() => setLayout(layout === 'split' ? 'unified' : 'split')}
            >
              {layout === 'split' ? <Columns2 /> : <Rows3 />}
            </Button>
          </IconTip>
          <Button
            variant="secondary"
            className="source-commit"
            isDisabled={!files.length}
            onPress={() => setCommitOpen(true)}
          >
            <GitCommitHorizontal aria-hidden="true" />
            {t('source.commitBranch')}
          </Button>
        </span>
      </div>
      <CommitBranchDialog
        open={commitOpen}
        projectPath={projectPath}
        fromBranch={status.data.branch}
        files={files.map((file) => file.path)}
        onClose={() => setCommitOpen(false)}
        onCommitted={() => {
          setOpenPaths(new Set())
          setLocalTick((value) => value + 1)
        }}
      />
      {status.data.truncated && <p className="source-note">{t('source.truncatedList')}</p>}
      {restoreError && <p className="source-note">{restoreError}</p>}
      <div className="source-scroll">
        {[...openPaths]
          .filter((path) => !files.some((file) => file.path === path))
          .map((path) => (
            <LoadedDiff
              key={path}
              projectPath={projectPath}
              path={path}
              tick={tick + localTick}
              embedded
              fallback={path === initialPath ? fallback : undefined}
              layout={layout}
              onBack={() =>
                setOpenPaths((current) => {
                  const next = new Set(current)
                  next.delete(path)
                  return next
                })
              }
            />
          ))}
        {showFallback && fallback?.length ? (
          <div className="source-change is-open">
            <div className="source-change-head">
              <span className="source-file">
                <span className="source-name">{fallbackLabel || t('source.changes')}</span>
              </span>
              <Button
                variant="ghost"
                className="source-back"
                onPress={() => setShowFallback(false)}
              >
                {t('common.cancel')}
              </Button>
            </div>
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
          </div>
        ) : null}
        <Accordion
          variant="surface"
          allowsMultipleExpanded
          className="source-change-list"
          expandedKeys={openPaths}
          onExpandedChange={(keys) => {
            setConfirmPath(null)
            setOpenPaths(new Set([...keys].map(String)))
          }}
        >
          {files.map((file) => (
            <ChangeRow
              key={file.path}
              file={file}
              open={openPaths.has(file.path)}
              confirming={confirmPath === file.path}
              agent={pathTouched(agent, file.path)}
              projectPath={projectPath}
              tick={tick + localTick}
              layout={layout}
              fallback={file.path === initialPath ? fallback : undefined}
              onOpenFile={() => source?.show({ tab: 'files', path: file.path, mode: 'view' })}
              onAskRestore={() => {
                setRestoreError('')
                setConfirmPath(file.path)
              }}
              onCancelRestore={() => setConfirmPath(null)}
              onRestore={() => void restore(file.path)}
            />
          ))}
        </Accordion>
      </div>
    </div>
  )
}

function ChangeRow({
  file,
  open,
  confirming,
  agent,
  projectPath,
  tick,
  layout,
  fallback,
  onOpenFile,
  onAskRestore,
  onCancelRestore,
  onRestore,
}: {
  file: GitFileStatus
  open: boolean
  confirming: boolean
  agent: boolean
  projectPath: string
  tick: number
  layout: 'unified' | 'split'
  fallback?: DiffLine[]
  onOpenFile: () => void
  onAskRestore: () => void
  onCancelRestore: () => void
  onRestore: () => void
}) {
  const t = useT()
  const [shown, setShown] = useState(open)
  if (open && !shown) setShown(true)
  const tracked = file.code !== '?'
  const additions = file.additions ?? 0
  const deletions = file.deletions ?? 0
  return (
    <Accordion.Item id={file.path} className="source-change">
      <Accordion.Heading className="source-change-head">
        <Accordion.Trigger className="source-change-toggle">
          <SourceFileIcon path={file.path} />
          <span className="source-file" title={file.path}>
            <span className="source-name">{file.path}</span>
            {(additions > 0 || deletions > 0) && (
              <span className="diff-stats">
                {additions > 0 && <span className="positive">+{additions}</span>}
                {deletions > 0 && <span className="negative">−{deletions}</span>}
              </span>
            )}
          </span>
          {agent && <span className="source-agent">{t('source.agent')}</span>}
        </Accordion.Trigger>
        <span className="source-change-actions">
          <IconTip label={t('source.openFile')}>
            <Button
              isIconOnly
              variant="ghost"
              className="icon-button"
              aria-label={t('source.openFile')}
              onPress={onOpenFile}
            >
              <FileSymlink />
            </Button>
          </IconTip>
          {tracked && (
            <IconTip label={t('source.restore')}>
              <Button
                isIconOnly
                variant="ghost"
                className="icon-button"
                aria-label={t('source.restore')}
                onPress={onAskRestore}
              >
                <Undo2 />
              </Button>
            </IconTip>
          )}
        </span>
        <Accordion.Indicator />
      </Accordion.Heading>
      {confirming && (
        <div className="source-restore">
          <p>{t('source.restoreConfirm')}</p>
          <Button size="sm" variant="danger" onPress={onRestore}>
            {t('source.restore')}
          </Button>
          <Button size="sm" variant="ghost" onPress={onCancelRestore}>
            {t('common.cancel')}
          </Button>
        </div>
      )}
      <Accordion.Panel>
        {shown && (
          <LoadedDiff
            projectPath={projectPath}
            path={file.path}
            tick={tick}
            embedded
            layout={layout}
            fallback={fallback}
          />
        )}
      </Accordion.Panel>
    </Accordion.Item>
  )
}
