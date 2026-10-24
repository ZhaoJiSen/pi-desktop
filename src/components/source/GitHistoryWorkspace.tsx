import { Button, Chip, Dropdown, Popover, SearchField, Tooltip } from '@heroui/react'
import {
  CalendarDays,
  LocateFixed,
  ListFilter,
  ArrowUp,
  ChevronDown,
  Columns2,
  GitBranch,
  Rows3,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from '../../lib/i18n'
import { OverflowTooltip } from '../OverflowTooltip'
import { HistoryReferences } from './HistoryReferences'
import { HistorySubject } from './HistorySubject'
import { HistoryHash } from './HistoryHash'
import { commitKinds, commitLabel } from '../../lib/source/historyLabels'
import {
  gitBranches,
  gitBranchState,
  gitCommitFiles,
  gitLogHead,
  gitLogPage,
} from '../../lib/source/api'
import { connectVisible, layoutGraph } from '../../lib/source/graph'
import type { CommitFile, GitCommit, GitHeadLocation, GitLogPage } from '../../lib/source/types'
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
import { GitNavigationSkeleton, GitReviewSkeleton } from './GitWorkspaceSkeleton'
import { DiffSkeleton } from './DiffSkeleton'
import { useDiffLayout } from './useDiffLayout'
import { useProjectSource } from './useProjectSource'
import { useSourceQuery, type SourceQuery } from './useSourceQuery'

export function GitHistoryWorkspace({
  navigation,
  navigationTabs,
  projectPath,
  tick,
  historyPath,
  onRepositoryChanged,
  remoteTick = 0,
}: {
  remoteTick?: number
  onRepositoryChanged?: () => void
  navigation: ReactNode
  navigationTabs?: ReactNode
  projectPath: string
  tick: number
  historyPath: string | null
}) {
  const t = useT()
  const branches = useSourceQuery(
    projectPath ? `branches:${projectPath}` : null,
    () => gitBranches(projectPath),
    `${tick}:${remoteTick}`,
  )
  const { revision } = useProjectSource()
  const [headTick, setHeadTick] = useState(0)
  const headState = useSourceQuery(
    projectPath ? `history-head:${projectPath}` : null,
    () => gitBranchState(projectPath),
    `${tick}:${remoteTick}:${revision}:${headTick}`,
  )
  useEffect(() => {
    const refreshHead = () => setHeadTick((value) => value + 1)
    window.addEventListener('focus', refreshHead)
    return () => window.removeEventListener('focus', refreshHead)
  }, [])
  const head = headState.data?.head ?? branches.data?.find((item) => item.current)?.tip ?? null
  const [location, setLocation] = useState<
    (GitHeadLocation & { nonce: number; tick: number }) | null
  >(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState('')
  const lookup = useRef(0)
  const lookupBusy = useRef(false)
  const activeLocation = location?.tick === tick ? location : null
  async function locateHead() {
    if (lookupBusy.current) return
    const nonce = ++lookup.current
    lookupBusy.current = true
    setLocating(true)
    setLocateError('')
    try {
      const next = await gitLogHead(projectPath)
      if (lookup.current !== nonce) return
      if (!next.head || !next.page.commits.some((commit) => commit.hash === next.head)) {
        setLocateError(t('source.headUnavailable'))
        return
      }
      setBranch(null)
      setBranchTip(null)
      setFile(null)
      setLocation({ ...next, nonce, tick })
      setHeadTick((value) => value + 1)
    } catch (error) {
      if (lookup.current === nonce)
        setLocateError(error instanceof Error ? error.message : String(error))
    } finally {
      if (lookup.current === nonce) {
        lookupBusy.current = false
        setLocating(false)
      }
    }
  }
  function returnToLatest() {
    lookup.current++
    lookupBusy.current = false
    setLocating(false)
    setLocateError('')
    setLocation(null)
  }
  const [filesHidden, setFilesHidden] = useState(false)
  const [diffHidden, setDiffHidden] = useState(false)
  const toggleFiles = useCallback(() => setFilesHidden((value) => !value), [])
  const toggleDiff = useCallback(() => setDiffHidden((value) => !value), [])
  const showDiff = useCallback(() => setDiffHidden(false), [])
  const [branch, setBranch] = useState<string | null>(null)
  const [branchTip, setBranchTip] = useState<string | null>(null)
  function chooseBranch(reference: string | null) {
    returnToLatest()
    setBranch(reference)
    setBranchTip(branches.data?.find((item) => branchReference(item) === reference)?.tip ?? null)
  }
  const [file, setFile] = useState(historyPath)
  const selected = branches.data?.find((item) => branchReference(item) === branch)
  const snapshot = useSourceQuery(
    branch ? `history-tip:${projectPath}:${branch}` : null,
    async () =>
      (await gitBranches(projectPath)).find((item) => branchReference(item) === branch)?.tip ??
      null,
    tick,
  )
  const logTip = snapshot.data ?? branchTip
  return (
    <GitNavigationSplit
      id="history"
      navigation={
        <aside className="git-history-navigation">
          {navigation}
          <GitBranchNavigator
            navigationHeader={navigationTabs}
            branches={branches.data ?? []}
            loading={branches.loading}
            error={branches.error}
            selected={branch}
            projectPath={projectPath}
            tick={tick}
            onSelect={chooseBranch}
            onChanged={onRepositoryChanged}
          />
        </aside>
      }
    >
      <div className="git-review-surface git-history-surface">
        {file && (
          <div className="git-path-filter">
            <OverflowTooltip text={t('source.historyForFile', { file })} />
            <SourceAction label={t('source.allCommits')} onPress={() => setFile(null)}>
              <X />
            </SourceAction>
          </div>
        )}
        <GitHistoryLog
          key={`${projectPath}:${branch ?? 'all'}:${logTip}:${tick}:${file}:${activeLocation?.nonce ?? 0}`}
          projectPath={projectPath}
          tip={logTip}
          tick={tick}
          historyPath={file}
          filesHidden={filesHidden}
          diffHidden={diffHidden}
          onToggleFiles={toggleFiles}
          onToggleDiff={toggleDiff}
          onShowDiff={showDiff}
          branchScope={selected?.name ?? null}
          onClearBranch={() => chooseBranch(null)}
          head={head}
          location={activeLocation}
          locating={locating}
          locateError={locateError}
          onLocateHead={() => void locateHead()}
          onLatest={returnToLatest}
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
  filesHidden,
  diffHidden,
  onToggleFiles,
  onToggleDiff,
  onShowDiff,
  head,
  location,
  locating,
  locateError,
  onLocateHead,
  onLatest,
}: {
  head: string | null
  location: GitHeadLocation | null
  locating: boolean
  locateError: string
  onLocateHead: () => void
  onLatest: () => void
  filesHidden: boolean
  diffHidden: boolean
  onToggleFiles: () => void
  onToggleDiff: () => void
  onShowDiff: () => void
  branchScope: string | null
  onClearBranch: () => void
  projectPath: string
  tip: string | null
  tick: number
  historyPath: string | null
}) {
  const t = useT()
  const language = useWorkspace((state) => state.language)
  const formatDate = useMemo(
    () => new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }),
    [language],
  )
  const request = useSourceQuery(
    projectPath && !location ? `workspace-log:${projectPath}:${tip}:${historyPath}` : null,
    () => gitLogPage(projectPath, historyPath, tip),
    tick,
  )
  const first: SourceQuery<GitLogPage> = location
    ? { loading: false, data: location.page }
    : request
  const offset = location?.offset ?? 0
  const [extra, setExtra] = useState<GitCommit[]>([])
  const [more, setMore] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)
  const loadingMore = useRef(false)
  const exhausted = useRef(false)
  const autoPaused = useRef(false)
  const nextOffset = useRef<number | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [error, setError] = useState('')
  const commits = useMemo(
    () => [...(first.data?.commits ?? []), ...extra],
    [extra, first.data?.commits],
  )
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchToggle = useRef<HTMLButtonElement>(null)
  const searchId = useId()
  const reduced = useReducedMotion()
  function closeSearch() {
    setQuery('')
    setSearchOpen(false)
    searchToggle.current?.focus()
  }
  const [kind, setKind] = useState('all')
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const commit of commits) {
      const key = commitLabel(commit.subject).kind
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [commits])
  const [author, setAuthor] = useState('')
  const [period, setPeriod] = useState(0)
  const [choice, setChoice] = useState<string | null>(location?.head ?? null)
  const authors = useMemo(
    () => [...new Set(commits.map((commit) => commit.author))].sort(),
    [commits],
  )
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const after = period ? Date.now() / 1000 - period * 86400 : 0
    return commits.filter(
      (commit) =>
        (kind === 'all' || commitLabel(commit.subject).kind === kind) &&
        (!author || commit.author === author) &&
        commit.timestamp >= after &&
        (!needle ||
          `${commit.subject} ${commit.hash} ${commit.author} ${commit.refs}`
            .toLowerCase()
            .includes(needle)),
    )
  }, [author, commits, kind, period, query])
  const connected = useMemo(
    () => connectVisible(commits, new Set(filtered.map((commit) => commit.hash))),
    [commits, filtered],
  )
  const graph = useMemo(() => layoutGraph(connected), [connected])
  const selectedIndex = useMemo(() => {
    const index = filtered.findIndex((item) => item.hash === choice)
    return index >= 0 ? index : filtered.length ? 0 : -1
  }, [choice, filtered])
  const commit = filtered[selectedIndex]
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
    onShowDiff()
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
  const centerHeadSelection = useRef(false)
  const rowKey = useCallback((index: number) => filtered[index]!.hash, [filtered])
  // oxlint-disable-next-line react/incompatible-library -- TanStack owns mutable measurements; do not memoize the virtualizer.
  const virtual = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scroller.current,
    getItemKey: rowKey,
    estimateSize: () => 34,
    overscan: 8,
  })
  useEffect(() => {
    if (selectedIndex >= 0)
      virtual.scrollToIndex(selectedIndex, {
        align:
          centerHeadSelection.current || (location && choice === location.head) ? 'center' : 'auto',
      })
    centerHeadSelection.current = false
    // Appending a page must keep the reader's position, even if the selected
    // commit is above the viewport. Only selection or filter changes reveal it.
  }, [author, kind, period, query, selectedIndex, virtual, location, choice])
  const mainRef = useRef<HTMLDivElement>(null)
  const filesToggle = useRef<HTMLButtonElement>(null)
  const diffToggle = useRef<HTMLButtonElement>(null)
  function hideFiles() {
    onToggleFiles()
    requestAnimationFrame(() => filesToggle.current?.focus())
  }
  function hideDiff() {
    onToggleDiff()
    requestAnimationFrame(() => diffToggle.current?.focus())
  }
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
  const showFiles = !compact && !filesHidden && Boolean(commit)
  const fileLayout = useDefaultLayout({
    id: 'pi.git-commit-columns.v1',
    panelIds: showFiles ? ['commits', 'commit-files'] : ['commits'],
    onlySaveAfterUserInteractions: true,
  })
  const savedLayout = useDefaultLayout({
    id: 'pi.git-history-layout.v1',
    panelIds: diffHidden ? ['log'] : ['log', 'diff'],
    onlySaveAfterUserInteractions: true,
  })
  const hasNext = more ?? first.data?.hasMore ?? false
  const filtering = Boolean(query.trim() || kind !== 'all' || author || period)
  const loadMore = useCallback(async () => {
    if (loadingMore.current || exhausted.current || !hasNext) return
    loadingMore.current = true
    autoPaused.current = false
    setPending(true)
    setError('')
    const skip = nextOffset.current ?? offset + commits.length
    try {
      const next = await gitLogPage(projectPath, historyPath, tip, skip)
      // This log is keyed by repository/ref/revision. Keep its result even
      // when Activity hides it while the request is in flight.
      // Advance through raw pages even when references move and pages overlap.
      nextOffset.current = skip + next.commits.length
      setExtra((current) => {
        const seen = new Set([...(first.data?.commits ?? []), ...current].map((item) => item.hash))
        const unique = next.commits.filter((item) => {
          if (seen.has(item.hash)) return false
          seen.add(item.hash)
          return true
        })
        return [...current, ...unique]
      })
      exhausted.current = !next.hasMore || next.commits.length === 0
      setMore(!exhausted.current)
    } catch (caught) {
      autoPaused.current = true
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      loadingMore.current = false
      setPending(false)
    }
  }, [commits.length, first.data?.commits, hasNext, historyPath, projectPath, tip, offset])
  useEffect(() => {
    const pane = scroller.current
    if (!pane) return
    const onScroll = () => {
      setScrolled(pane.scrollTop > 240)
      // One request per scroll approach; never scan all history to fill a filter.
      if (
        !filtering &&
        !error &&
        !autoPaused.current &&
        pane.scrollTop > 0 &&
        pane.scrollHeight - pane.scrollTop - pane.clientHeight <= 102
      ) {
        void loadMore()
      }
    }
    pane.addEventListener('scroll', onScroll, { passive: true })
    return () => pane.removeEventListener('scroll', onScroll)
  }, [error, filtering, first.loading, loadMore])
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
  if (first.loading && projectPath) return <GitReviewSkeleton view="history" />
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
        <Panel
          id="log"
          defaultSize="55%"
          minSize={240}
          maxSize={diffHidden ? undefined : '68%'}
          className="git-log-top"
        >
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
                  <OverflowTooltip text={branchScope ?? t('source.allBranches')} />
                  {branchScope && <X />}
                </Button>

                <Tooltip delay={450}>
                  <Tooltip.Trigger role="presentation" tabIndex={-1}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="git-log-head-action"
                      aria-label={t('source.locateHead')}
                      isPending={locating}
                      isDisabled={!head || locating}
                      onPress={() => {
                        const index = commits.findIndex((commit) => commit.hash === head)
                        if (index >= 0 && !filtering && !branchScope && !historyPath) {
                          centerHeadSelection.current = choice !== head
                          setChoice(head)
                          virtual.scrollToIndex(index, { align: 'center' })
                        } else onLocateHead()
                      }}
                    >
                      <LocateFixed />
                      <span className="git-log-head-label">HEAD</span>
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{t('source.locateHeadHelp')}</Tooltip.Content>
                </Tooltip>
                <Dropdown>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="git-log-filter"
                    aria-label={`${t('source.commitType')}: ${kind === 'all' ? t('source.allTypes') : kind === 'branch' ? t('source.otherType') : kind}`}
                    data-active={kind !== 'all'}
                  >
                    <ListFilter className="git-filter-icon" />
                    <span className="git-filter-value">
                      {kind === 'all'
                        ? t('source.allTypes')
                        : kind === 'branch'
                          ? t('source.otherType')
                          : kind}
                    </span>
                    <ChevronDown className="git-filter-chevron" />
                  </Button>
                  <Dropdown.Popover
                    className="action-popover git-history-filter-popover git-type-popover"
                    maxHeight={360}
                  >
                    <Dropdown.Menu
                      aria-label={t('source.commitType')}
                      selectionMode="single"
                      selectedKeys={[kind]}
                      onAction={(key) => setKind(String(key))}
                    >
                      <Dropdown.Item id="all" textValue={t('source.allTypes')}>
                        <span>{t('source.allTypes')}</span>
                        <small className="git-type-count">{commits.length}</small>
                        <Dropdown.ItemIndicator />
                      </Dropdown.Item>
                      {[...commitKinds, 'branch']
                        .filter((value) => kindCounts.has(value) || kind === value)
                        .map((value) => (
                          <Dropdown.Item
                            key={value}
                            id={value}
                            textValue={value === 'branch' ? t('source.otherType') : value}
                          >
                            <Chip size="sm" variant="soft" className="git-kind" data-kind={value}>
                              {value === 'branch' ? t('source.otherType') : value}
                            </Chip>
                            <small className="git-type-count">{kindCounts.get(value) ?? 0}</small>
                            <Dropdown.ItemIndicator />
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
                    aria-label={`${t('source.author')}: ${author || t('source.allAuthors')}`}
                    data-active={Boolean(author)}
                  >
                    <UserRound className="git-filter-icon" />
                    <OverflowTooltip
                      className="git-filter-value"
                      text={author || t('source.allAuthors')}
                    />
                    <ChevronDown className="git-filter-chevron" />
                  </Button>
                  <Dropdown.Popover
                    className="action-popover git-history-filter-popover"
                    maxHeight={360}
                  >
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
                    <OverflowTooltip
                      className="git-filter-value"
                      text={t(
                        period === 7
                          ? 'source.lastWeek'
                          : period === 30
                            ? 'source.lastMonth'
                            : 'source.anyTime',
                      )}
                    />
                    <ChevronDown className="git-filter-chevron" />
                  </Button>
                  <Dropdown.Popover
                    className="action-popover git-history-filter-popover"
                    maxHeight={360}
                  >
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
                <div className="git-log-view-actions">
                  <Tooltip delay={450}>
                    <Button
                      ref={searchToggle}
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      className="source-action"
                      aria-label={t(
                        searchOpen ? 'source.closeCommitSearch' : 'source.filterCommits',
                      )}
                      aria-expanded={searchOpen}
                      aria-controls={searchId}
                      onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                    >
                      {searchOpen ? <X /> : <Search />}
                    </Button>
                    <Tooltip.Content placement="bottom">
                      {t(searchOpen ? 'source.closeCommitSearch' : 'source.filterCommits')}
                    </Tooltip.Content>
                  </Tooltip>
                  <span className="git-toolbar-divider" aria-hidden="true" />
                  <SourceAction
                    buttonRef={filesToggle}
                    label={t(showFiles ? 'source.hideChangedFiles' : 'source.showChangedFiles')}
                    pressed={showFiles}
                    isDisabled={!commit}
                    onPress={() => (compact ? setQuickFind(true) : onToggleFiles())}
                  >
                    {showFiles ? <PanelRightClose /> : <PanelRightOpen />}
                  </SourceAction>
                  <SourceAction
                    buttonRef={diffToggle}
                    label={t(diffHidden ? 'source.showDiff' : 'source.hideDiff')}
                    pressed={!diffHidden}
                    onPress={onToggleDiff}
                  >
                    {diffHidden ? <PanelBottomOpen /> : <PanelBottomClose />}
                  </SourceAction>
                </div>
                <AnimatePresence initial={false}>
                  {searchOpen && (
                    <motion.div
                      id={searchId}
                      className="git-log-search-reveal"
                      initial={reduced ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.16 }}
                    >
                      <SearchField
                        aria-label={t('source.filterCommits')}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            closeSearch()
                          }
                        }}
                        value={query}
                        onChange={setQuery}
                        variant="secondary"
                        className="git-search git-log-search"
                      >
                        <SearchField.Group>
                          <SearchField.SearchIcon />
                          <SearchField.Input autoFocus placeholder={t('source.searchLog')} />
                          <SearchField.ClearButton />
                        </SearchField.Group>
                      </SearchField>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="git-log-columns">
                <span>{t('source.commitMessage')}</span>
                <span>{t('source.author')}</span>
                <span>{t('source.date')}</span>
                <span>Hash</span>
              </div>
              <HoverScrollArea
                className="git-log-scroll"
                viewportClassName="git-log-viewport"
                viewportRef={scroller}
                label={t('source.history')}
                shadowSize={18}
              >
                <div className="git-log-rows" role="listbox" aria-label={t('source.history')}>
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
                        <div
                          key={item.hash}
                          role="option"
                          aria-selected={item.hash === commit?.hash}
                          className="git-log-row"
                          data-current={item.hash === head || undefined}
                          aria-current={item.hash === head ? 'location' : undefined}
                          style={{
                            position: 'absolute',
                            top: row.start,
                            height: row.size,
                            width: '100%',
                          }}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setChoice(item.hash)
                              return
                            }
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
                        >
                          <span className="git-log-subject">
                            <HistoryGraph row={graph[row.index]!} height={34} />
                            {item.hash === head && (
                              <Chip
                                size="sm"
                                variant="soft"
                                className="git-head-badge"
                                aria-label={t('source.currentCommit')}
                              >
                                HEAD
                              </Chip>
                            )}
                            <HistorySubject subject={item.subject} />
                            {item.refs && <HistoryReferences refs={item.refs} />}
                          </span>
                          <OverflowTooltip className="git-log-author" text={item.author} />
                          <time dateTime={new Date(item.timestamp * 1000).toISOString()}>
                            {formatDate.format(item.timestamp * 1000)}
                          </time>
                          <HistoryHash hash={item.hash} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </HoverScrollArea>
              <div className="git-log-status">
                <span className="git-log-count" aria-live="polite">
                  {offset > 0
                    ? t('source.loadedCommitWindow', {
                        start: offset + 1,
                        end: offset + commits.length,
                      })
                    : t('source.loadedCommitCount', { count: commits.length })}
                  {filtering && (
                    <>
                      <span className="git-log-count-divider" aria-hidden="true">
                        ·
                      </span>
                      {t('source.matchingCommitCount', { count: filtered.length })}
                    </>
                  )}
                </span>
                <div className="git-log-pagination-actions">
                  {offset > 0 && (
                    <Button size="sm" variant="ghost" onPress={onLatest}>
                      {t('source.latestCommits')}
                    </Button>
                  )}
                  {hasNext ? (
                    <>
                      {!filtering && !error && !pending && (
                        <span className="git-log-auto-hint">{t('source.scrollForMore')}</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        isPending={pending}
                        onPress={() => void loadMore()}
                      >
                        {t(error ? 'source.retryLoad' : 'source.loadMore')}
                      </Button>
                    </>
                  ) : (
                    commits.length > 0 && (
                      <span>
                        {t(offset > 0 ? 'source.oldestCommitLoaded' : 'source.allHistoryLoaded')}
                      </span>
                    )
                  )}
                  {scrolled && (
                    <SourceAction
                      label={t('source.backToTop')}
                      onPress={() => scroller.current?.scrollTo({ top: 0 })}
                    >
                      <ArrowUp />
                    </SourceAction>
                  )}
                </div>
                {(error || locateError) && (
                  <p className="git-log-page-error" role="alert">
                    {error || locateError}
                  </p>
                )}
              </div>
            </Panel>
            {showFiles && (
              <Separator
                className="git-column-separator"
                aria-label={t('source.resizeCommitFiles')}
              />
            )}
            {showFiles && (
              <Panel
                id="commit-files"
                minSize={190}
                defaultSize={240}
                maxSize="45%"
                groupResizeBehavior="preserve-pixel-size"
                className="git-commit-column"
              >
                {detail.loading ? (
                  <GitNavigationSkeleton />
                ) : detail.error ? (
                  <SourceNotice kind="error" text={detail.error} />
                ) : (
                  <CommitFiles
                    resizable
                    commit={commit}
                    files={files}
                    selected={selectedFile}
                    onSelect={chooseFile}
                    onHide={hideFiles}
                  />
                )}
              </Panel>
            )}
          </Group>
        </Panel>
        {!diffHidden && (
          <>
            <Separator className="git-log-separator" aria-label={t('source.resizeHistory')} />
            <Panel id="diff" minSize={160} className="git-log-bottom">
              {detail.loading ? (
                <DiffSkeleton />
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
                  onHide={hideDiff}
                />
              ) : (
                <SourceNotice kind="empty" text={t('source.missingDiff')} />
              )}
            </Panel>
          </>
        )}
      </Group>
    </div>
  )
}

function CommitFiles({
  commit,
  files,
  selected,
  onSelect,
  onHide,
  resizable = false,
}: {
  resizable?: boolean
  onHide?: () => void
  commit: GitCommit
  files: CommitFile[]
  selected: string | null
  onSelect: (path: string) => void
}) {
  const t = useT()
  const language = useWorkspace((state) => state.language)
  const layout = useDefaultLayout({
    id: 'pi.git-commit-details.v1',
    panelIds: ['files', 'details'],
    onlySaveAfterUserInteractions: true,
  })
  const navigator = (
    <GitFileNavigator
      initialFlat
      basic
      compactSearch
      headingActions={
        onHide ? (
          <SourceAction label={t('source.hideChangedFiles')} onPress={onHide}>
            <PanelRightClose />
          </SourceAction>
        ) : undefined
      }
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
  )
  const details = (
    <div className="git-commit-details">
      <OverflowTooltip as="strong" text={commit.subject} />
      <div className="git-commit-metadata">
        <OverflowTooltip text={commit.author} />
        <OverflowTooltip as="code" text={commit.hash.slice(0, 12)} tooltip={commit.hash} />
      </div>
      <time dateTime={new Date(commit.timestamp * 1000).toISOString()}>
        {new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
          commit.timestamp * 1000,
        )}
      </time>
    </div>
  )
  if (resizable) {
    return (
      <Group
        orientation="vertical"
        className="git-commit-split"
        defaultLayout={layout.defaultLayout}
        onLayoutChanged={layout.onLayoutChanged}
      >
        <Panel id="files" minSize={96} className="git-commit-file-panel">
          {navigator}
        </Panel>
        <Separator
          className="git-log-separator git-commit-details-separator"
          aria-label={t('source.resizeCommitDetails')}
        />
        <Panel
          id="details"
          minSize={64}
          defaultSize={78}
          maxSize="60%"
          groupResizeBehavior="preserve-pixel-size"
          className="git-commit-details-panel"
        >
          <HoverScrollArea
            className="git-commit-details-scroll"
            label={t('source.commitDetails')}
            shadowSize={12}
          >
            {details}
          </HoverScrollArea>
        </Panel>
      </Group>
    )
  }
  return (
    <>
      {navigator}
      {details}
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
  onHide,
}: {
  onHide: () => void
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
        <SourceAction label={t('source.hideDiff')} onPress={onHide}>
          <PanelBottomClose />
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
