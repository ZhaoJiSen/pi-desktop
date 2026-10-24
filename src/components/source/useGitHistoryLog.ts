import { useVirtualizer } from '@tanstack/react-virtual'
import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { useT } from '../../lib/i18n'
import { gitLogPage } from '../../lib/source/api'
import { connectVisible, layoutGraph } from '../../lib/source/graph'
import type { GitCommit, GitLogPage } from '../../lib/source/types'
import { useWorkspace } from '../../store/workspace'
import { useHistoryCommit } from './useHistoryCommit'
import { useHistoryFilters } from './useHistoryFilters'
import { useSourceQuery, type SourceQuery } from './useSourceQuery'

export function useGitHistoryLog({
  head,
  branchScope,
  onLocateHead,
  projectPath,
  location,
  tip,
  historyPath,
  tick,
  onShowDiff,
  onToggleFiles,
  onToggleDiff,
  filesHidden,
  diffHidden,
}: {
  head: string | null
  branchScope: string | null
  onLocateHead: () => void
  projectPath: string
  location: import('../../lib/source/types').GitHeadLocation | null
  tip: string | null
  historyPath: string | null
  tick: number
  onShowDiff: () => void
  onToggleFiles: () => void
  onToggleDiff: () => void
  filesHidden: boolean
  diffHidden: boolean
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
  const {
    kind,
    setKind,
    kindCounts,
    author,
    setAuthor,
    period,
    setPeriod,
    choice,
    setChoice,
    authors,
    filtered,
  } = useHistoryFilters({ commits, location, query })

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
  const { detail, files, selectedFile, quickFind, setQuickFind, chooseFile } = useHistoryCommit({
    commit,
    projectPath,
    tick,
    historyPath,
    onShowDiff,
  })

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
  function locateCurrentHead() {
    const index = commits.findIndex((item) => item.hash === head)
    if (index >= 0 && !filtering && !branchScope && !historyPath) {
      centerHeadSelection.current = choice !== head
      setChoice(head)
      virtual.scrollToIndex(index, { align: 'center' })
    } else onLocateHead()
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
  return {
    t,
    formatDate,
    first,
    offset,
    pending,
    scrolled,
    error,
    commits,
    query,
    setQuery,
    searchOpen,
    setSearchOpen,
    searchToggle,
    searchId,
    reduced,
    closeSearch,
    kind,
    setKind,
    kindCounts,
    author,
    setAuthor,
    period,
    setPeriod,
    setChoice,
    authors,
    filtered,
    graph,
    commit,
    detail,
    files,
    selectedFile,
    quickFind,
    setQuickFind,
    chooseFile,
    scroller,
    locateCurrentHead,
    virtual,
    mainRef,
    filesToggle,
    diffToggle,
    hideFiles,
    hideDiff,
    compact,
    showFiles,
    fileLayout,
    savedLayout,
    hasNext,
    filtering,
    loadMore,
    notice,
  }
}
