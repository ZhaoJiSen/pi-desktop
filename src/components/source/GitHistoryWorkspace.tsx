import { Button, Dropdown, Popover, SearchField } from '@heroui/react'
import {
  CalendarDays,
  ChevronDown,
  Columns2,
  GitBranch,
  Rows3,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useT } from '../../lib/i18n'
import { gitBranches, gitCommitFiles, gitLogPage } from '../../lib/source/api'
import { connectVisible, layoutGraph } from '../../lib/source/graph'
import type { CommitFile, GitCommit } from '../../lib/source/types'
import { useWorkspace } from '../../store/workspace'
import { HoverScrollArea } from '../HoverScrollArea'
import { GitFileNavigator, GitQuickFind } from './GitFileNavigator'
import { GitNavigationSplit } from './GitNavigationSplit'
import { GitBranchNavigator } from './GitBranchNavigator'
import { branchReference } from '../../lib/source/branches'
import { HistoryGraph } from './HistoryGraph'
import { LoadedDiff } from './LoadedDiff'
import { SourceAction } from './SourceAction'
import { SourceFilePath } from './SourceFilePath'
import { SourceNotice } from './SourceNotice'
import { useDiffLayout } from './useDiffLayout'
import { useSourceQuery } from './useSourceQuery'

export function GitHistoryWorkspace({
  navigation,
  projectPath,
  tick,
  historyPath,
  onRepositoryChanged,
}: {
  onRepositoryChanged?: () => void
  navigation: ReactNode
  projectPath: string
  tick: number
  historyPath: string | null
}) {
  const t = useT()
  const branches = useSourceQuery(
    projectPath ? `branches:${projectPath}` : null,
    () => gitBranches(projectPath),
    tick,
  )
  const [branch, setBranch] = useState<string | null>(null)
  const [file, setFile] = useState(historyPath)
  const selected = branches.data?.find((item) => branchReference(item) === branch)
  return (
    <GitNavigationSplit
      id="history"
      navigation={
        <aside className="git-history-navigation">
          {navigation}
          <GitBranchNavigator
            branches={branches.data ?? []}
            loading={branches.loading}
            error={branches.error}
            selected={branch}
            projectPath={projectPath}
            tick={tick}
            onSelect={setBranch}
            onChanged={onRepositoryChanged}
          />
        </aside>
      }
    >
      <div className="git-review-surface git-history-surface">
        {file && (
          <div className="git-path-filter">
            <span>{t('source.historyForFile', { file })}</span>
            <SourceAction label={t('source.allCommits')} onPress={() => setFile(null)}>
              <X />
            </SourceAction>
          </div>
        )}
        <GitHistoryLog
          key={`${projectPath}:${selected?.tip ?? 'all'}:${tick}:${file}`}
          projectPath={projectPath}
          tip={selected?.tip ?? null}
          tick={tick}
          historyPath={file}
          branchScope={selected?.name ?? null}
          onClearBranch={() => setBranch(null)}
        />
      </div>
    </GitNavigationSplit>
  )
}

function GitHistoryLog({
  projectPath,
  tip,
  tick,
  historyPath,
  branchScope,
  onClearBranch,
}: {
  branchScope: string | null
  onClearBranch: () => void
  projectPath: string
  tip: string | null
  tick: number
  historyPath: string | null
}) {
  const t = useT()
  const language = useWorkspace((state) => state.language)
  const first = useSourceQuery(
    projectPath ? `workspace-log:${projectPath}:${tip}:${historyPath}` : null,
    () => gitLogPage(projectPath, historyPath, tip),
    tick,
  )
  const [extra, setExtra] = useState<GitCommit[]>([])
  const [more, setMore] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const commits = useMemo(
    () => [...(first.data?.commits ?? []), ...extra],
    [extra, first.data?.commits],
  )
  const [query, setQuery] = useState('')
  const [author, setAuthor] = useState('')
  const [period, setPeriod] = useState(0)
  const [choice, setChoice] = useState<string | null>(null)
  const authors = useMemo(
    () => [...new Set(commits.map((commit) => commit.author))].sort(),
    [commits],
  )
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const after = period ? Date.now() / 1000 - period * 86400 : 0
    return commits.filter(
      (commit) =>
        (!author || commit.author === author) &&
        commit.timestamp >= after &&
        (!needle ||
          `${commit.subject} ${commit.hash} ${commit.author} ${commit.refs}`
            .toLowerCase()
            .includes(needle)),
    )
  }, [author, commits, period, query])
  const connected = useMemo(
    () => connectVisible(commits, new Set(filtered.map((commit) => commit.hash))),
    [commits, filtered],
  )
  const graph = useMemo(() => layoutGraph(connected), [connected])
  const commit = filtered.find((item) => item.hash === choice) ?? filtered[0]
  const detail = useSourceQuery(
    commit ? `workspace-commit:${projectPath}:${commit.hash}` : null,
    () => gitCommitFiles(projectPath, commit!.hash),
    tick,
  )
  const files = detail.data?.files ?? []
  const [choices, setChoices] = useState<Record<string, string>>({})
  const selectedFile =
    files.find((file) => file.path === (choices[commit?.hash ?? ''] ?? historyPath))?.path ??
    files[0]?.path ??
    null
  const [quickFind, setQuickFind] = useState(false)
  function chooseFile(path: string) {
    if (commit) setChoices((current) => ({ ...current, [commit.hash]: path }))
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setQuickFind(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const scroller = useRef<HTMLDivElement>(null)
  // oxlint-disable-next-line react/incompatible-library -- TanStack owns mutable measurements; do not memoize the virtualizer.
  const virtual = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 34,
    overscan: 8,
  })
  const selectedIndex = filtered.findIndex((item) => item.hash === commit?.hash)
  useEffect(() => {
    if (selectedIndex >= 0) virtual.scrollToIndex(selectedIndex, { align: 'auto' })
  }, [filtered, selectedIndex, virtual])
  const mainRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const node = mainRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) =>
      setCompact((entry?.contentRect.width ?? 0) < 680),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [first.loading, first.data?.repo, first.error, projectPath])
  const fileLayout = useDefaultLayout({
    id: 'pi.git-commit-columns.v1',
    panelIds: compact || !commit ? ['commits'] : ['commits', 'commit-files'],
    onlySaveAfterUserInteractions: true,
  })
  const savedLayout = useDefaultLayout({
    id: 'pi.git-history-layout.v1',
    onlySaveAfterUserInteractions: true,
  })
  async function loadMore() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const next = await gitLogPage(projectPath, historyPath, tip, commits.length)
      if (alive.current) {
        setExtra((current) => [
          ...current,
          ...next.commits.filter(
            (item) => !commits.some((existing) => existing.hash === item.hash),
          ),
        ])
        setMore(next.hasMore)
      }
    } catch (caught) {
      if (alive.current) setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      if (alive.current) setPending(false)
    }
  }
  const notice = !projectPath
    ? t('source.noProject')
    : first.loading
      ? t('source.loading')
      : first.error
        ? first.error
        : !first.data?.available
          ? t('source.gitMissing')
          : !first.data.repo
            ? t('source.notRepository')
            : null
  if (notice)
    return (
      <SourceNotice
        kind={first.error ? 'error' : first.loading ? 'loading' : 'empty'}
        text={notice}
      />
    )
  return (
    <div ref={mainRef} className="git-history-main" data-compact={compact || undefined}>
      {quickFind && (
        <GitQuickFind
          files={files}
          selected={selectedFile}
          onSelect={chooseFile}
          onClose={() => setQuickFind(false)}
          scope={commit ? `${t('source.commit')} ${commit.hash.slice(0, 7)}` : undefined}
        />
      )}

      <Group
        orientation="vertical"
        className="git-log-split"
        defaultLayout={savedLayout.defaultLayout}
        onLayoutChanged={savedLayout.onLayoutChanged}
      >
        <Panel id="log" defaultSize="55%" minSize={240} maxSize="68%" className="git-log-top">
          <Group
            orientation="horizontal"
            className="git-log-columns-split"
            defaultLayout={fileLayout.defaultLayout}
            onLayoutChanged={fileLayout.onLayoutChanged}
          >
            <Panel id="commits" minSize={180} className="git-log-table">
              <div className="git-log-toolbar">
                <Button
                  variant="ghost"
                  size="sm"
                  className="git-log-scope"
                  aria-label={t('source.logScope')}
                  onPress={onClearBranch}
                  isDisabled={!branchScope}
                >
                  <GitBranch />
                  <span>{branchScope ?? t('source.allBranches')}</span>
                  {branchScope && <X />}
                </Button>
                <SearchField
                  aria-label={t('source.filterCommits')}
                  value={query}
                  onChange={setQuery}
                  variant="secondary"
                  className="git-search git-log-search"
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={t('source.searchLog')} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <Dropdown>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="git-log-filter"
                    aria-label={`${t('source.author')}: ${author || t('source.allAuthors')}`}
                    data-active={Boolean(author)}
                  >
                    <UserRound className="git-filter-icon" />
                    <span className="git-filter-value">{author || t('source.allAuthors')}</span>
                    <ChevronDown className="git-filter-chevron" />
                  </Button>
                  <Dropdown.Popover className="action-popover">
                    <Dropdown.Menu
                      aria-label={t('source.author')}
                      selectionMode="single"
                      selectedKeys={[author || 'all']}
                      onAction={(key) => setAuthor(key === 'all' ? '' : String(key))}
                    >
                      <Dropdown.Item id="all">{t('source.allAuthors')}</Dropdown.Item>
                      {authors.map((item) => (
                        <Dropdown.Item key={item} id={item}>
                          {item}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
                <Dropdown>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="git-log-filter"
                    aria-label={`${t('source.date')}: ${t(period === 7 ? 'source.lastWeek' : period === 30 ? 'source.lastMonth' : 'source.anyTime')}`}
                    data-active={Boolean(period)}
                  >
                    <CalendarDays className="git-filter-icon" />
                    <span className="git-filter-value">
                      {t(
                        period === 7
                          ? 'source.lastWeek'
                          : period === 30
                            ? 'source.lastMonth'
                            : 'source.anyTime',
                      )}
                    </span>
                    <ChevronDown className="git-filter-chevron" />
                  </Button>
                  <Dropdown.Popover className="action-popover">
                    <Dropdown.Menu
                      aria-label={t('source.date')}
                      selectionMode="single"
                      selectedKeys={[String(period)]}
                      onAction={(key) => setPeriod(Number(key))}
                    >
                      <Dropdown.Item id="0">{t('source.anyTime')}</Dropdown.Item>
                      <Dropdown.Item id="7">{t('source.lastWeek')}</Dropdown.Item>
                      <Dropdown.Item id="30">{t('source.lastMonth')}</Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>

              <div className="git-log-columns">
                <span>{t('source.commitMessage')}</span>
                <span>{t('source.author')}</span>
                <span>{t('source.date')}</span>
                <span>Hash</span>
              </div>
              <div
                className="git-log-rows"
                ref={scroller}
                role="listbox"
                aria-label={t('source.history')}
              >
                {!filtered.length && (
                  <SourceNotice
                    kind="empty"
                    text={commits.length ? t('source.emptyFilter') : t('source.emptyHistory')}
                  />
                )}
                <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
                  {virtual.getVirtualItems().map((row) => {
                    const item = filtered[row.index]!
                    return (
                      <button
                        type="button"
                        key={item.hash}
                        role="option"
                        aria-selected={item.hash === commit?.hash}
                        className="git-log-row"
                        style={{
                          position: 'absolute',
                          top: row.start,
                          height: row.size,
                          width: '100%',
                        }}
                        onKeyDown={(event) => {
                          if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
                          event.preventDefault()
                          const index =
                            event.key === 'Home'
                              ? 0
                              : event.key === 'End'
                                ? filtered.length - 1
                                : Math.max(
                                    0,
                                    Math.min(
                                      filtered.length - 1,
                                      row.index + (event.key === 'ArrowDown' ? 1 : -1),
                                    ),
                                  )
                          setChoice(filtered[index]!.hash)
                          virtual.scrollToIndex(index)
                          requestAnimationFrame(() =>
                            scroller.current
                              ?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)
                              ?.focus(),
                          )
                        }}
                        tabIndex={item.hash === commit?.hash ? 0 : -1}
                        data-row-index={row.index}
                        onClick={() => setChoice(item.hash)}
                        title={`${item.subject}\n${item.author} · ${item.hash}`}
                      >
                        <span className="git-log-subject">
                          <HistoryGraph row={graph[row.index]!} height={34} />
                          <span>{item.subject}</span>
                          {item.refs && (
                            <small className="git-ref-label">
                              {item.refs.replace('HEAD -> ', '')}
                            </small>
                          )}
                        </span>
                        <span className="git-log-author">{item.author}</span>
                        <time dateTime={new Date(item.timestamp * 1000).toISOString()}>
                          {new Intl.DateTimeFormat(language, {
                            month: 'short',
                            day: 'numeric',
                          }).format(item.timestamp * 1000)}
                        </time>
                        <code>{item.hash.slice(0, 7)}</code>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="git-log-status">
                <span>
                  {t('source.loadedCommits', { count: filtered.length, total: commits.length })}
                </span>
                {(more ?? first.data?.hasMore) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    isPending={pending}
                    onPress={() => void loadMore()}
                  >
                    {t('source.loadMore')}
                  </Button>
                )}
                {error && <span role="alert">{error}</span>}
              </div>
            </Panel>
            {commit && !compact && (
              <Separator
                className="git-column-separator"
                aria-label={t('source.resizeCommitFiles')}
              />
            )}
            {commit && !compact && (
              <Panel
                id="commit-files"
                minSize={190}
                defaultSize={240}
                maxSize="45%"
                groupResizeBehavior="preserve-pixel-size"
                className="git-commit-column"
              >
                {detail.loading ? (
                  <SourceNotice kind="loading" text={t('source.loading')} />
                ) : detail.error ? (
                  <SourceNotice kind="error" text={detail.error} />
                ) : (
                  <CommitFiles
                    commit={commit}
                    files={files}
                    selected={selectedFile}
                    onSelect={chooseFile}
                  />
                )}
              </Panel>
            )}
          </Group>
        </Panel>
        <Separator className="git-log-separator" aria-label={t('source.resizeHistory')} />
        <Panel id="diff" minSize={160} className="git-log-bottom">
          {detail.loading ? (
            <SourceNotice kind="loading" text={t('source.loading')} />
          ) : detail.error ? (
            <SourceNotice kind="error" text={detail.error} />
          ) : commit && selectedFile ? (
            <CommitPreview
              commit={commit}
              projectPath={projectPath}
              tick={tick}
              path={selectedFile}
              files={files}
              onSelectFile={chooseFile}
              onFind={() => setQuickFind(true)}
            />
          ) : (
            <SourceNotice kind="empty" text={t('source.missingDiff')} />
          )}
        </Panel>
      </Group>
    </div>
  )
}

function CommitFiles({
  commit,
  files,
  selected,
  onSelect,
}: {
  commit: GitCommit
  files: CommitFile[]
  selected: string | null
  onSelect: (path: string) => void
}) {
  const t = useT()
  const language = useWorkspace((state) => state.language)
  return (
    <>
      <GitFileNavigator
        initialFlat
        basic
        files={files}
        selected={selected}
        onSelect={onSelect}
        heading={
          <div className="git-commit-files-heading">
            {t('source.changedFiles')}
            <span>{files.length}</span>
          </div>
        }
      />
      <div className="git-commit-details">
        <strong>{commit.subject}</strong>
        <div className="git-commit-metadata">
          <span>{commit.author}</span>
          <code title={commit.hash}>{commit.hash.slice(0, 12)}</code>
        </div>
        <time dateTime={new Date(commit.timestamp * 1000).toISOString()}>
          {new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
            commit.timestamp * 1000,
          )}
        </time>
      </div>
    </>
  )
}

function CommitPreview({
  commit,
  projectPath,
  tick,
  path,
  files,
  onSelectFile,
  onFind,
}: {
  commit: GitCommit
  projectPath: string
  tick: number
  path: string
  files: CommitFile[]
  onSelectFile: (path: string) => void
  onFind: () => void
}) {
  const t = useT()
  const { ref, layout, setLayout } = useDiffLayout()
  const [filesOpen, setFilesOpen] = useState(false)
  return (
    <div className="git-commit-preview">
      <div className="git-diff-heading" ref={ref}>
        <SourceFilePath path={path} />
        <Popover isOpen={filesOpen} onOpenChange={setFilesOpen}>
          <Button variant="secondary" size="sm" className="git-compact-files-trigger">
            {t('source.commitMany', { count: files.length })}
            <ChevronDown />
          </Button>
          <Popover.Content className="git-commit-popover" placement="top end" offset={8}>
            <Popover.Dialog
              aria-label={t('source.changedFiles')}
              style={{ height: Math.min(420, Math.max(230, files.length * 48 + 180)) }}
            >
              <CommitFiles
                commit={commit}
                files={files}
                selected={path}
                onSelect={(next) => {
                  onSelectFile(next)
                  setFilesOpen(false)
                }}
              />
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
        <SourceAction label={t('source.quickOpen')} onPress={onFind}>
          <Search />
        </SourceAction>
        <SourceAction
          label={t(layout === 'split' ? 'source.unified' : 'source.split')}
          onPress={() => setLayout(layout === 'split' ? 'unified' : 'split')}
        >
          {layout === 'split' ? <Columns2 /> : <Rows3 />}
        </SourceAction>
      </div>
      <div className="git-diff-caption">
        <span>
          {commit.parents[0]?.slice(0, 7) ?? t('source.initialCommit')} → {commit.hash.slice(0, 7)}
        </span>
      </div>
      <HoverScrollArea
        className="source-preview-scroll"
        viewportClassName="source-scroll"
        label={path}
      >
        <LoadedDiff
          projectPath={projectPath}
          path={path}
          revision={commit.hash}
          tick={tick}
          layout={layout}
          embedded
        />
      </HoverScrollArea>
    </div>
  )
}
