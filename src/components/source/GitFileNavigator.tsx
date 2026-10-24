import { Button, SearchField, Tooltip } from '@heroui/react'
import { FolderTree, List, Search, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useT } from '../../lib/i18n'
import { useWorkspace } from '../../store/workspace'
import { HoverScrollArea } from '../HoverScrollArea'
import { FilePathTree } from './FilePathTree'
import { GitFileList, NavigableFile, useFileSearch } from './GitFileList'
import { SourceAction } from './SourceAction'
import { SourceNotice } from './SourceNotice'

export function GitFileNavigator({
  files,
  selected,
  onSelect,
  heading,
  headingActions,
  navigationHeader,
  footer,
  notice,
  basic = false,
  initialFlat = false,
  persistView = false,
  revealKey = 0,
  agent,
  onQuickOpen,
  compactSearch = false,
}: {
  files: NavigableFile[]
  selected: string | null
  onSelect: (path: string) => void
  heading?: ReactNode
  headingActions?: ReactNode
  navigationHeader?: ReactNode
  footer?: ReactNode
  notice?: ReactNode
  basic?: boolean
  revealKey?: number
  initialFlat?: boolean
  persistView?: boolean
  agent?: Set<string>
  onQuickOpen?: () => void
  compactSearch?: boolean
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [localFlat, setLocalFlat] = useState(initialFlat)
  const savedView = useWorkspace((state) => state.gitChangesView)
  const setPreference = useWorkspace((state) => state.setPreference)
  const flat = persistView ? savedView === 'list' : localFlat
  function toggleView() {
    if (persistView) setPreference({ gitChangesView: flat ? 'tree' : 'list' })
    else setLocalFlat((value) => !value)
  }
  const [searchOpen, setSearchOpen] = useState(false)
  const searchToggle = useRef<HTMLButtonElement>(null)
  const searchId = useId()
  const reduced = useReducedMotion()
  function closeSearch() {
    setQuery('')
    setSearchOpen(false)
    searchToggle.current?.focus()
  }
  const matched = useFileSearch(files, query)
  const filtered = useMemo(
    () =>
      matched.filter(
        (file) =>
          filter === 'all' || file.code.includes(filter) || (filter === 'A' && file.code === '?'),
      ),
    [matched, filter],
  )
  const searchAction = (
    <Tooltip delay={450}>
      <Button
        ref={searchToggle}
        isIconOnly
        variant="ghost"
        size="sm"
        className="source-action git-search-toggle"
        aria-label={searchOpen ? t('source.closeFileSearch') : t('source.searchFiles')}
        aria-expanded={searchOpen}
        aria-controls={searchId}
        onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
      >
        {searchOpen ? <X /> : <Search />}
      </Button>
      <Tooltip.Content placement="bottom">
        {searchOpen ? t('source.closeFileSearch') : t('source.searchFiles')}
      </Tooltip.Content>
    </Tooltip>
  )
  const quickOpenAction = (
    <Tooltip delay={450}>
      <Tooltip.Trigger role="presentation" tabIndex={-1}>
        <Button
          variant="ghost"
          size="sm"
          className="git-quick-trigger"
          aria-label={t('source.quickOpen')}
          onPress={onQuickOpen}
        >
          <kbd>
            ⌘P<span> / Ctrl P</span>
          </kbd>
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content placement="bottom">{t('source.quickOpen')} (⌘P / Ctrl P)</Tooltip.Content>
    </Tooltip>
  )
  const searchField = (
    <AnimatePresence initial={false}>
      {(!compactSearch || searchOpen) && (
        <motion.div
          id={searchId}
          className="git-file-search-reveal"
          initial={compactSearch && !reduced ? { height: 0, opacity: 0 } : false}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.16 }}
        >
          <div className="git-file-search-row">
            <SearchField
              aria-label={t('source.searchFiles')}
              value={query}
              onChange={setQuery}
              variant="secondary"
              className="git-search"
              onKeyDown={(event) => {
                if (compactSearch && event.key === 'Escape') {
                  event.preventDefault()
                  closeSearch()
                }
              }}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  autoFocus={compactSearch}
                  placeholder={t('source.searchFiles')}
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            {onQuickOpen && quickOpenAction}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
  const grouped = compactSearch && !basic
  const navigationFooter =
    grouped && !footer && !notice ? null : (
      <div className="git-navigator-footer">
        {footer}
        {notice}
        {(!compactSearch || (basic && !query.trim() && filter === 'all')) && (
          <span className="git-result-count">
            {t('source.filteredFiles', { count: filtered.length, total: files.length })}
          </span>
        )}
      </div>
    )
  return (
    <div className="git-file-navigator">
      {basic && compactSearch ? (
        <div className="git-file-compact-heading">
          {heading}
          <div className="git-file-tools">
            {searchAction}
            {headingActions}
          </div>
        </div>
      ) : (
        heading
      )}
      <div
        className={
          grouped
            ? 'git-navigation-surface git-file-navigation-surface'
            : 'git-file-navigation-content'
        }
      >
        {navigationHeader}
        {!compactSearch && searchField}
        {!basic && (
          <div className="git-file-filters">
            <div role="group" aria-label={t('source.fileStatus')}>
              {['all', 'M', 'A', 'D'].map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant="ghost"
                  aria-pressed={filter === value}
                  onPress={() => setFilter(value)}
                >
                  {value === 'all' ? t('source.allFiles') : value}
                </Button>
              ))}
            </div>
            {compactSearch && (
              <small
                className="git-navigation-result"
                aria-label={t('source.filteredFiles', {
                  count: filtered.length,
                  total: files.length,
                })}
              >
                {filtered.length} / {files.length}
              </small>
            )}
            <div className="git-file-tools">
              {compactSearch && searchAction}
              <SourceAction
                label={flat ? t('source.treeView') : t('source.listView')}
                onPress={toggleView}
              >
                {flat ? <FolderTree /> : <List />}
              </SourceAction>
            </div>
          </div>
        )}
        {compactSearch && searchField}
        {compactSearch && (query.trim() || filter !== 'all') && (
          <p className="git-navigation-filter-scope" role="status">
            {t('source.navigationFilterScope', { count: filtered.length, total: files.length })}
          </p>
        )}
        {!filtered.length ? (
          <SourceNotice
            kind="empty"
            text={files.length ? t('source.emptySearch') : t('source.emptyChanges')}
          />
        ) : flat || query.trim() ? (
          <GitFileList
            files={filtered}
            selected={selected}
            onSelect={onSelect}
            label={t('source.changedFiles')}
          />
        ) : (
          <HoverScrollArea
            shadowSize={compactSearch ? 18 : 0}
            className="source-tree-scroll"
            label={t('source.changedFiles')}
          >
            <FilePathTree
              revealKey={revealKey}
              files={filtered}
              selected={selected}
              onSelect={onSelect}
              agent={agent}
            />
          </HoverScrollArea>
        )}
        {grouped && navigationFooter}
      </div>
      {!grouped && navigationFooter}
    </div>
  )
}

export { GitQuickFind } from './GitQuickFind'

export { GitFileList, useFileSearch, type NavigableFile } from './GitFileList'
