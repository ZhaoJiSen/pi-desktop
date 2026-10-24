import { Button, ListBox, Modal, SearchField, Tooltip } from '@heroui/react'
import { FolderTree, List, Search, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Fuse, { type FuseResultMatch } from 'fuse.js'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useT } from '../../lib/i18n'
import { useWorkspace } from '../../store/workspace'
import { fileNameOf } from '../../lib/source/paths'
import type { CommitFile, GitFileStatus } from '../../lib/source/types'
import { OverflowTooltip } from '../OverflowTooltip'
import { HoverScrollArea } from '../HoverScrollArea'
import { FilePathTree } from './FilePathTree'
import { FileTreeIcon } from './FileTreeIcon'
import { SourceAction } from './SourceAction'
import { SourceNotice } from './SourceNotice'

export type NavigableFile = (CommitFile | GitFileStatus) & {
  searchMatches?: readonly FuseResultMatch[]
}

export function useFileSearch(files: NavigableFile[], query: string) {
  const index = useMemo(
    () =>
      new Fuse(
        files.map((file) => ({ ...file, name: fileNameOf(file.path) })),
        {
          keys: [
            { name: 'name', weight: 0.7 },
            { name: 'path', weight: 0.3 },
          ],
          threshold: 0.35,
          ignoreLocation: true,
          includeMatches: true,
        },
      ),
    [files],
  )
  return useMemo(
    () =>
      query.trim()
        ? index
            .search(query.trim())
            .map((result) => ({ ...result.item, searchMatches: result.matches }))
        : files,
    [files, index, query],
  )
}

export function GitFileList({
  files,
  selected,
  onSelect,
  label,
}: {
  files: NavigableFile[]
  selected: string | null
  onSelect: (path: string) => void
  label: string
}) {
  const parent = useRef<HTMLDivElement>(null)
  // oxlint-disable-next-line react/incompatible-library -- TanStack owns mutable measurements; do not memoize the virtualizer.
  const virtual = useVirtualizer({
    count: files.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 48,
    gap: 4,
    overscan: 8,
  })
  const selectedIndex = files.findIndex((file) => file.path === selected)
  useEffect(() => {
    if (selectedIndex >= 0) virtual.scrollToIndex(selectedIndex, { align: 'auto' })
    else if (files.length) virtual.scrollToIndex(0, { align: 'start' })
  }, [files, selectedIndex, virtual])
  return (
    <div
      className="git-file-list"
      ref={parent}
      onKeyDownCapture={(event) => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || !files.length) return
        event.preventDefault()
        event.stopPropagation()
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? files.length - 1
              : Math.max(
                  0,
                  Math.min(files.length - 1, selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)),
                )
        onSelect(files[index]!.path)
        virtual.scrollToIndex(index, { align: 'auto' })
        requestAnimationFrame(() =>
          parent.current?.querySelector<HTMLElement>(`[data-file-index="${index}"]`)?.focus(),
        )
      }}
    >
      <ListBox
        aria-label={label}
        selectionMode="single"
        selectedKeys={selected ? [selected] : []}
        onAction={(key) => onSelect(String(key))}
        className="git-file-options"
        style={{ height: virtual.getTotalSize() }}
      >
        {virtual.getVirtualItems().map((row) => {
          const file = files[row.index]!
          return (
            <ListBox.Item
              key={file.path}
              id={file.path}
              data-file-index={row.index}
              textValue={file.path}
              className="git-file-option"
              style={{ position: 'absolute', top: row.start, height: row.size, width: '100%' }}
            >
              <FileTreeIcon name={fileNameOf(file.path)} kind="file" expanded={false} />
              <span className="git-file-label">
                <OverflowTooltip text={fileNameOf(file.path)} tooltip={file.path}>
                  <MatchedText file={file} field="name" />
                </OverflowTooltip>
                <OverflowTooltip as="small" text={file.path}>
                  <MatchedText file={file} field="path" />
                </OverflowTooltip>
              </span>
              <span className="source-code" data-code={file.code}>
                {file.code}
              </span>
            </ListBox.Item>
          )
        })}
      </ListBox>
    </div>
  )
}

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

export function GitQuickFind({
  files,
  selected,
  onSelect,
  onClose,
  scope,
}: {
  files: NavigableFile[]
  selected: string | null
  onSelect: (path: string) => void
  onClose: () => void
  scope?: string
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const results = useFileSearch(files, query)
  const [active, setActive] = useState(0)
  const current = Math.min(active, Math.max(0, results.length - 1))
  const list = useRef<HTMLDivElement>(null)
  // oxlint-disable-next-line react/incompatible-library -- TanStack owns mutable measurements; do not memoize the virtualizer.
  const quickVirtual = useVirtualizer({
    count: results.length,
    getScrollElement: () => list.current,
    estimateSize: () => 48,
    overscan: 8,
  })
  useEffect(() => {
    quickVirtual.scrollToIndex(current, { align: 'auto' })
  }, [current, quickVirtual])
  function choose(path: string) {
    onSelect(path)
    onClose()
  }
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
      className="dialog-backdrop git-quick-backdrop"
    >
      <Modal.Container size="md" className="git-quick-container">
        <Modal.Dialog className="git-quick-dialog" aria-label={t('source.quickOpen')}>
          <Modal.Header>
            <Modal.Heading className="sr-only">{t('source.quickOpen')}</Modal.Heading>
            <label className="git-quick-input">
              <Search />
              <input
                autoFocus
                value={query}
                placeholder={t('source.searchFiles')}
                role="combobox"
                aria-controls="git-quick-results"
                aria-expanded="true"
                aria-autocomplete="list"
                aria-activedescendant={results[current] ? `git-quick-${current}` : undefined}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                  quickVirtual.scrollToIndex(0, { align: 'start' })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActive(
                      Math.max(
                        0,
                        Math.min(
                          results.length - 1,
                          current + (event.key === 'ArrowDown' ? 1 : -1),
                        ),
                      ),
                    )
                  }
                  if (event.key === 'Enter' && results[current]) {
                    event.preventDefault()
                    choose(results[current]!.path)
                  }
                }}
                aria-label={t('source.searchFiles')}
              />
              <kbd>esc</kbd>
            </label>
          </Modal.Header>
          <Modal.Body>
            <div className="git-quick-scope">
              <span role="status" aria-live="polite">
                {t('source.fileSearchResults', { count: results.length, total: files.length })}
              </span>
              {scope && <span>{scope}</span>}
            </div>
            <div
              className="git-quick-results"
              ref={list}
              role="listbox"
              id="git-quick-results"
              aria-label={t('source.changedFiles')}
            >
              <div style={{ height: quickVirtual.getTotalSize(), position: 'relative' }}>
                {quickVirtual.getVirtualItems().map((row) => {
                  const index = row.index
                  const file = results[index]!
                  return (
                    <button
                      type="button"
                      id={`git-quick-${index}`}
                      key={file.path}
                      role="option"
                      aria-selected={current === index}
                      data-index={index}
                      style={{
                        position: 'absolute',
                        top: row.start,
                        height: row.size,
                        width: '100%',
                      }}
                      className="git-quick-row"
                      onClick={() => choose(file.path)}
                    >
                      <FileTreeIcon name={fileNameOf(file.path)} kind="file" expanded={false} />
                      <span className="git-file-label">
                        <OverflowTooltip text={fileNameOf(file.path)} tooltip={file.path}>
                          <MatchedText file={file} field="name" />
                        </OverflowTooltip>
                        <OverflowTooltip as="small" text={file.path}>
                          <MatchedText file={file} field="path" />
                        </OverflowTooltip>
                      </span>
                      <span className="source-code" data-code={file.code}>
                        {file.code}
                      </span>
                      {selected === file.path && <span aria-hidden="true">•</span>}
                    </button>
                  )
                })}
              </div>
              {!results.length && <SourceNotice kind="empty" text={t('source.emptySearch')} />}
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function MatchedText({ file, field }: { file: NavigableFile; field: 'name' | 'path' }) {
  const text = field === 'name' ? fileNameOf(file.path) : file.path
  const ranges = file.searchMatches?.find((match) => match.key === field)?.indices ?? []
  const pieces: ReactNode[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) pieces.push(text.slice(cursor, start))
    pieces.push(<mark key={`${start}-${end}`}>{text.slice(start, end + 1)}</mark>)
    cursor = end + 1
  }
  pieces.push(text.slice(cursor))
  return <>{pieces}</>
}
