import { Button, SearchField, Tooltip } from '@heroui/react'
import {
  GitBranch,
  LocateFixed,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { OverflowTooltip } from '../OverflowTooltip'
import { GitAuthorFilter } from './GitAuthorFilter'
import { GitDateFilter } from './GitDateFilter'
import { GitTypeFilter } from './GitTypeFilter'
import { SourceAction } from './SourceAction'
import type { useGitHistoryLog } from './useGitHistoryLog'

export function GitHistoryToolbar({
  t,
  onClearBranch,
  branchScope,
  locating,
  head,
  commits,
  onLocateHead,
  kind,
  setKind,
  kindCounts,
  author,
  setAuthor,
  authors,
  period,
  setPeriod,
  searchToggle,
  searchOpen,
  searchId,
  closeSearch,
  setSearchOpen,
  filesToggle,
  showFiles,
  commit,
  compact,
  setQuickFind,
  onToggleFiles,
  diffToggle,
  diffHidden,
  onToggleDiff,
  reduced,
  query,
  setQuery,
}: Pick<
  ReturnType<typeof useGitHistoryLog>,
  | 't'
  | 'commits'
  | 'kind'
  | 'setKind'
  | 'kindCounts'
  | 'author'
  | 'setAuthor'
  | 'authors'
  | 'period'
  | 'setPeriod'
  | 'searchToggle'
  | 'searchOpen'
  | 'searchId'
  | 'closeSearch'
  | 'setSearchOpen'
  | 'filesToggle'
  | 'showFiles'
  | 'commit'
  | 'compact'
  | 'setQuickFind'
  | 'diffToggle'
  | 'reduced'
  | 'query'
  | 'setQuery'
> & {
  onClearBranch: () => void
  branchScope: string | null
  locating: boolean
  head: string | null
  onLocateHead: () => void
  onToggleFiles: () => void
  diffHidden: boolean
  onToggleDiff: () => void
}) {
  return (
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
            onPress={onLocateHead}
          >
            <LocateFixed />
            <span className="git-log-head-label">HEAD</span>
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>{t('source.locateHeadHelp')}</Tooltip.Content>
      </Tooltip>
      <GitTypeFilter
        t={t}
        kind={kind}
        setKind={setKind}
        commits={commits}
        kindCounts={kindCounts}
      />
      <GitAuthorFilter t={t} author={author} setAuthor={setAuthor} authors={authors} />
      <GitDateFilter t={t} period={period} setPeriod={setPeriod} />
      <div className="git-log-view-actions">
        <Tooltip delay={450}>
          <Button
            ref={searchToggle}
            isIconOnly
            size="sm"
            variant="ghost"
            className="source-action"
            aria-label={t(searchOpen ? 'source.closeCommitSearch' : 'source.filterCommits')}
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
  )
}
