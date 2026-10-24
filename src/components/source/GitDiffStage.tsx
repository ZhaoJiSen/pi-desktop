import { Accordion, Button } from '@heroui/react'
import type * as React from 'react'
import { navigateToPage } from '../../router/navigation'
import type { useSource } from './context'
import { GitFileActionBar } from './GitFileActionBar'
import { GitFilePathLabel } from './GitFilePathLabel'
import { LoadedDiff } from './LoadedDiff'
import type { useDiffLayout } from './useDiffLayout'

export function GitDiffStage({
  expandedKeys,
  setCollapsed,
  files,
  virtual,
  knownStats,
  statsScope,
  collapsed,
  viewport,
  t,
  source,
  setError,
  setConfirmPath,
  restoring,
  confirmPath,
  restore,
  error,
  projectPath,
  tick,
  layout,
  load,
  reportStats,
  fallback,
}: {
  expandedKeys: Set<string>
  setCollapsed: React.Dispatch<React.SetStateAction<Set<string>>>
  files: import('../../lib/source/types').GitFileStatus[]
  virtual: import('@tanstack/react-virtual').ReactVirtualizer<HTMLDivElement, Element>
  knownStats: { scope: string; files: Record<string, { additions: number; deletions: number }> }
  statsScope: string
  collapsed: Set<string>
  viewport: React.RefObject<HTMLDivElement | null>
  t: import('../../lib/locale').Translator
  source: ReturnType<typeof useSource>
  setError: React.Dispatch<React.SetStateAction<{ path: string; message: string } | null>>
  setConfirmPath: React.Dispatch<React.SetStateAction<string | null>>
  restoring: boolean
  confirmPath: string | null
  restore: (path: string) => Promise<void>
  error: { path: string; message: string } | null
  projectPath: string
  tick: number
  layout: ReturnType<typeof useDiffLayout>['layout']
  load: (path: string) => Promise<import('../../lib/source/types').GitDiff>
  reportStats: (path: string, stats: { additions: number; deletions: number } | null) => void
  fallback: { path: string; lines: import('../../types').DiffLine[] } | undefined
}) {
  return (
    <Accordion
      variant="surface"
      allowsMultipleExpanded
      expandedKeys={expandedKeys}
      onExpandedChange={(keys) =>
        setCollapsed(new Set(files.filter((file) => !keys.has(file.path)).map((file) => file.path)))
      }
      className="git-diff-stage"
      style={{ height: virtual.getTotalSize() }}
    >
      {virtual.getVirtualItems().map((row) => {
        const file = files[row.index]!
        const stats = knownStats.scope === statsScope ? knownStats.files[file.path] : undefined
        const additions = stats?.additions ?? file.additions
        const deletions = stats?.deletions ?? file.deletions
        const isCollapsed = collapsed.has(file.path)
        return (
          <Accordion.Item
            key={file.path}
            id={file.path}
            onExpandedChange={(expanded) => {
              if (!expanded && (viewport.current?.scrollTop ?? 0) > row.start)
                virtual.scrollToIndex(row.index, { align: 'start' })
            }}
            ref={virtual.measureElement}
            data-index={row.index}
            data-diff-path={file.path}
            data-collapsed={isCollapsed || undefined}
            className="git-diff-section"
            aria-label={file.path}
            style={{
              top: row.start,
              minHeight:
                !isCollapsed && row.index === files.length - 1
                  ? virtual.scrollRect?.height
                  : undefined,
            }}
          >
            <header className="source-detail-bar source-preview-bar git-diff-file-header">
              <Accordion.Heading className="git-file-heading">
                <Accordion.Trigger
                  className="git-file-trigger"
                  aria-label={t(isCollapsed ? 'source.expandFileDiff' : 'source.collapseFileDiff', {
                    file: file.path,
                  })}
                >
                  <GitFilePathLabel path={file.path} />
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <GitFileActionBar
                stats={
                  additions !== undefined || deletions !== undefined
                    ? { additions, deletions }
                    : undefined
                }
                onOpen={() => {
                  source?.show({ tab: 'files', path: file.path, mode: 'view', projectPath })
                  void navigateToPage('chat')
                }}
                onRestore={
                  file.code && file.code !== '?'
                    ? () => {
                        setCollapsed((current) => {
                          const next = new Set(current)
                          next.delete(file.path)
                          return next
                        })
                        setError(null)
                        setConfirmPath(file.path)
                      }
                    : undefined
                }
                restoring={restoring}
              />
            </header>
            <Accordion.Panel>
              <Accordion.Body className="git-diff-body">
                {confirmPath === file.path && (
                  <div className="source-restore">
                    <p>{t('source.restoreConfirm')}</p>
                    <span className="source-restore-actions">
                      <Button
                        size="sm"
                        variant="danger"
                        isPending={restoring}
                        onPress={() => void restore(file.path)}
                      >
                        {t('source.restore')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        isDisabled={restoring}
                        onPress={() => {
                          setConfirmPath(null)
                          setError(null)
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    </span>
                  </div>
                )}
                {error?.path === file.path && (
                  <p className="source-note" role="alert">
                    {error.message}
                  </p>
                )}
                <LoadedDiff
                  projectPath={projectPath}
                  path={file.path}
                  tick={tick}
                  embedded
                  layout={layout}
                  load={() => load(file.path)}
                  onStats={reportStats}
                  fallback={fallback?.path === file.path ? fallback.lines : undefined}
                />
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        )
      })}
    </Accordion>
  )
}
