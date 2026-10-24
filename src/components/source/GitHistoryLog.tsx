import { Group, Panel, Separator } from 'react-resizable-panels'
import type { GitHeadLocation } from '../../lib/source/types'
import { DiffSkeleton } from './DiffSkeleton'
import { CommitFiles } from './GitCommitFiles'
import { CommitPreview } from './GitCommitPreview'
import { GitQuickFind } from './GitFileNavigator'
import { GitHistoryFooter } from './GitHistoryFooter'
import { GitHistoryRows } from './GitHistoryRows'
import { GitHistoryToolbar } from './GitHistoryToolbar'
import { GitNavigationSkeleton, GitReviewSkeleton } from './GitWorkspaceSkeleton'
import { SourceNotice } from './SourceNotice'
import { useGitHistoryLog } from './useGitHistoryLog'

export function GitHistoryLog({
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
  const {
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
  } = useGitHistoryLog({
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
    head,
    branchScope,
    onLocateHead,
  })

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
              <GitHistoryToolbar
                t={t}
                onClearBranch={onClearBranch}
                branchScope={branchScope}
                locating={locating}
                head={head}
                commits={commits}
                onLocateHead={locateCurrentHead}
                kind={kind}
                setKind={setKind}
                kindCounts={kindCounts}
                author={author}
                setAuthor={setAuthor}
                authors={authors}
                period={period}
                setPeriod={setPeriod}
                searchToggle={searchToggle}
                searchOpen={searchOpen}
                searchId={searchId}
                closeSearch={closeSearch}
                setSearchOpen={setSearchOpen}
                filesToggle={filesToggle}
                showFiles={showFiles}
                commit={commit}
                compact={compact}
                setQuickFind={setQuickFind}
                onToggleFiles={onToggleFiles}
                diffToggle={diffToggle}
                diffHidden={diffHidden}
                onToggleDiff={onToggleDiff}
                reduced={reduced}
                query={query}
                setQuery={setQuery}
              />

              <div className="git-log-columns">
                <span>{t('source.commitMessage')}</span>
                <span>{t('source.author')}</span>
                <span>{t('source.date')}</span>
                <span>Hash</span>
              </div>
              <GitHistoryRows
                scroller={scroller}
                t={t}
                filtered={filtered}
                commits={commits}
                virtual={virtual}
                commit={commit}
                head={head}
                setChoice={setChoice}
                graph={graph}
                formatDate={formatDate}
              />
              <GitHistoryFooter
                offset={offset}
                t={t}
                commits={commits}
                filtering={filtering}
                filtered={filtered}
                onLatest={onLatest}
                hasNext={hasNext}
                error={error}
                pending={pending}
                loadMore={loadMore}
                scrolled={scrolled}
                scroller={scroller}
                locateError={locateError}
              />
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
