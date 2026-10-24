import { Accordion, Button } from '@heroui/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitFileDiff, gitRestoreFile } from '../../lib/source/api'
import type { GitDiff, GitFileStatus } from '../../lib/source/types'
import { navigateToPage } from '../../router/navigation'
import type { DiffLine } from '../../types'
import { HoverScrollArea } from '../HoverScrollArea'
import { useSource } from './context'
import { GitFileActionBar, GitDiffLayoutControl } from './GitFileActionBar'
import { GitFilePathLabel } from './GitFilePathLabel'
import { LoadedDiff } from './LoadedDiff'
import { SourceNotice } from './SourceNotice'
import { useDiffLayout } from './useDiffLayout'

/** One scroll document; file navigation is an anchor, never a content filter. */
export function GitChangesReview({
  files,
  projectPath,
  tick,
  jump,
  onActiveChange,
  onRestored,
  fallback,
}: {
  files: GitFileStatus[]
  projectPath: string
  tick: number
  jump: { path: string | null; nonce: number }
  onActiveChange: (path: string) => void
  onRestored: (path: string) => void
  fallback?: { path: string; lines: DiffLine[] }
}) {
  const t = useT()
  const source = useSource()
  const viewport = useRef<HTMLDivElement>(null)
  const { ref: layoutRef, layout, setLayout } = useDiffLayout()
  const [confirmPath, setConfirmPath] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const expandedKeys = useMemo(
    () => new Set(files.filter((file) => !collapsed.has(file.path)).map((file) => file.path)),
    [files, collapsed],
  )
  const [restoring, setRestoring] = useState(false)
  const restoringRef = useRef(false)
  const [error, setError] = useState<{ path: string; message: string } | null>(null)
  const cache = useRef(new Map<string, Promise<GitDiff>>())
  const statsScope = JSON.stringify([projectPath, tick])
  const [knownStats, setKnownStats] = useState<{
    scope: string
    files: Record<string, { additions: number; deletions: number }>
  }>({ scope: statsScope, files: {} })
  if (knownStats.scope !== statsScope) setKnownStats({ scope: statsScope, files: {} })
  const reportStats = useCallback(
    (path: string, stats: { additions: number; deletions: number } | null) => {
      if (!stats) return
      setKnownStats((current) => {
        if (current.scope !== statsScope) return current
        const old = current.files[path]
        if (old?.additions === stats.additions && old.deletions === stats.deletions) return current
        return { scope: statsScope, files: { ...current.files, [path]: stats } }
      })
    },
    [statsScope],
  )
  const load = useCallback(
    (path: string) => {
      const key = JSON.stringify([projectPath, tick, path])
      const cached = cache.current.get(key)
      if (cached) {
        cache.current.delete(key)
        cache.current.set(key, cached)
        return cached
      }
      const request: Promise<GitDiff> = gitFileDiff(projectPath, path).catch((reason: unknown) => {
        if (cache.current.get(key) === request) cache.current.delete(key)
        throw reason
      })
      cache.current.set(key, request)
      // Retain recently read patches without keeping every visited file in memory.
      if (cache.current.size > 24) cache.current.delete(cache.current.keys().next().value!)
      return request
    },
    [projectPath, tick],
  )
  const keyOf = useCallback((index: number) => files[index]!.path, [files])
  // oxlint-disable-next-line react/incompatible-library -- TanStack owns mutable measurements; do not memoize its instance.
  const virtual = useVirtualizer({
    count: files.length,
    getScrollElement: () => viewport.current,
    getItemKey: keyOf,
    estimateSize: (index) => {
      const file = files[index]!
      if (collapsed.has(file.path)) return 58
      return (
        82 + Math.min(800, Math.max(140, ((file.additions ?? 0) + (file.deletions ?? 0) + 8) * 28))
      )
    },
    overscan: 2,
    useAnimationFrameWithResizeObserver: true,
  })
  const handledJump = useRef<typeof jump | null>(null)
  useLayoutEffect(() => {
    if (handledJump.current === jump) return
    const index = files.findIndex((file) => file.path === jump.path)
    if (index >= 0) {
      if (collapsed.has(files[index]!.path)) {
        setCollapsed((current) => {
          const next = new Set(current)
          next.delete(files[index]!.path)
          return next
        })
        return
      }
      virtual.scrollToIndex(index, { align: 'start' })
      handledJump.current = jump
    }
  }, [collapsed, files, jump, virtual])
  const pane = viewport.current
  const atEnd =
    pane && pane.scrollTop > 0 && pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2
  const active =
    files[
      atEnd
        ? files.length - 1
        : (virtual.getVirtualItemForOffset((virtual.scrollOffset ?? 0) + 1)?.index ?? 0)
    ]?.path
  useEffect(() => {
    if (active) onActiveChange(active)
  }, [active, onActiveChange])

  async function restore(path: string) {
    if (restoringRef.current) return
    restoringRef.current = true
    setRestoring(true)
    setError(null)
    try {
      await gitRestoreFile(projectPath, path)
      setConfirmPath(null)
      onRestored(path)
    } catch (reason) {
      setError({
        path,
        message: reason instanceof Error ? reason.message : t('source.missingDiff'),
      })
    } finally {
      restoringRef.current = false
      setRestoring(false)
    }
  }
  return (
    <div className="git-changes-review" ref={layoutRef}>
      {!files.length ? (
        <SourceNotice kind="empty" text={t('source.emptyChanges')} />
      ) : (
        <>
          <div className="git-review-toolbar">
            <span>
              {t('source.changedFiles')} <small>{files.length}</small>
            </span>
            <GitDiffLayoutControl
              layout={layout}
              onToggle={() => setLayout(layout === 'split' ? 'unified' : 'split')}
            />
          </div>
          <HoverScrollArea
            className="git-diff-stream"
            viewportClassName="source-scroll git-diff-viewport"
            viewportRef={viewport}
            label={t('source.changes')}
            shadowSize={0}
          >
            <Accordion
              variant="surface"
              allowsMultipleExpanded
              expandedKeys={expandedKeys}
              onExpandedChange={(keys) =>
                setCollapsed(
                  new Set(files.filter((file) => !keys.has(file.path)).map((file) => file.path)),
                )
              }
              className="git-diff-stage"
              style={{ height: virtual.getTotalSize() }}
            >
              {virtual.getVirtualItems().map((row) => {
                const file = files[row.index]!
                const stats =
                  knownStats.scope === statsScope ? knownStats.files[file.path] : undefined
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
                          aria-label={t(
                            isCollapsed ? 'source.expandFileDiff' : 'source.collapseFileDiff',
                            { file: file.path },
                          )}
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
          </HoverScrollArea>
        </>
      )}
    </div>
  )
}
