import {
  Button,
  Chip,
  Dropdown,
  Header,
  ListBox,
  SearchField,
  Select,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react'
import { Plus, RotateCw, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { PackageScrollArea } from '../../components/extension-packages/PackageScrollArea'
import { SidebarOption } from '../../components/SidebarOption'
import { useT } from '../../lib/i18n'
import type { LibraryEntry } from '../../lib/capabilities/library'
import { CommandNotice, CommandEmpty } from './CommandFeedback'

export type LibraryFilters = { query: string; source: string; kind: string; status: string }
const sources = ['all', 'desktop', 'pi', 'plugin', 'local', 'user'] as const
const kinds = ['all', 'task', 'mode', 'command', 'prompt', 'skill'] as const
const statuses = ['all', 'pinned', 'disabled', 'unavailable'] as const
export function LibraryBrowser({
  all,
  entries,
  selected,
  filters,
  onFilter,
  onChoose,
  onNew,
  refresh,
  loading,
  error,
  hasDraft,
}: {
  all: LibraryEntry[]
  entries: LibraryEntry[]
  selected: string | null
  filters: LibraryFilters
  onFilter: (patch: Partial<LibraryFilters>) => void
  onChoose: (entry: LibraryEntry, open?: boolean) => void
  onNew: (kind: 'prompt' | 'shortcut') => void
  refresh: () => void
  loading: boolean
  error: string
  hasDraft: (id: string) => boolean
}) {
  const t = useT(),
    reduced = useReducedMotion()
  const [searchOpen, setSearchOpen] = useState(false)
  const search = useRef<HTMLInputElement>(null),
    toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (searchOpen) search.current?.focus()
  }, [searchOpen])
  const closeSearch = () => {
    onFilter({ query: '' })
    setSearchOpen(false)
    toggle.current?.focus()
  }
  const renderEntry = (entry: LibraryEntry) => (
    <ListBox.Item
      key={entry.id}
      id={entry.id}
      textValue={`${entry.name} /${entry.alias} ${entry.origin}`}
      className="command-row sidebar-option"
      data-disabled-entry={!entry.enabled}
      onPress={() => onChoose(entry, true)}
    >
      <SidebarOption
        title={entry.name}
        subtitle={
          entry.description || (entry.source === 'pi' ? t('library.source.pi') : `/${entry.alias}`)
        }
      />
      {(hasDraft(entry.id) || !entry.enabled || entry.unavailable) && (
        <span className="library-row-state">
          {hasDraft(entry.id)
            ? t('library.draft')
            : t(!entry.enabled ? 'library.status.disabled' : 'library.unavailableShort')}
        </span>
      )}
    </ListBox.Item>
  )
  return (
    <section className="commands-browser library-browser" aria-label={t('capability.library')}>
      <div className="commands-browser-heading">
        <div className="commands-browser-identity">
          <h2 className="commands-browser-title">{t('capability.library')}</h2>
          <Chip size="sm" variant="soft" className="commands-count">
            {entries.length === all.length ? all.length : `${entries.length} / ${all.length}`}
          </Chip>
        </div>
        <div className="commands-tools">
          <Button
            ref={toggle}
            isIconOnly
            variant="ghost"
            className="commands-tool-button"
            aria-label={t(searchOpen ? 'packages.closeSearch' : 'commands.search')}
            aria-expanded={searchOpen}
            aria-controls="library-search"
            onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            {searchOpen ? <X /> : <Search />}
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            className="commands-tool-button"
            aria-label={t('commands.refresh')}
            isPending={loading}
            isDisabled={loading}
            onPress={refresh}
          >
            <RotateCw />
          </Button>
          <Dropdown>
            <Button
              isIconOnly
              variant="ghost"
              className="commands-tool-button"
              aria-label={t('capability.new')}
            >
              <Plus />
            </Button>
            <Dropdown.Popover className="action-popover" placement="bottom end">
              <Dropdown.Menu
                aria-label={t('capability.new')}
                onAction={(key) => onNew(key === 'shortcut' ? 'shortcut' : 'prompt')}
              >
                <Dropdown.Item id="prompt" textValue={t('library.newPrompt')}>
                  {t('library.newPrompt')}
                </Dropdown.Item>
                <Dropdown.Item id="shortcut" textValue={t('library.newShortcut')}>
                  {t('library.newShortcut')}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>
      {searchOpen && (
        <motion.div
          className="commands-toolbar"
          id="library-search"
          initial={reduced ? false : { opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.15 }}
        >
          <SearchField
            className="commands-search"
            aria-label={t('commands.search')}
            value={filters.query}
            onChange={(query) => onFilter({ query })}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                closeSearch()
              }
            }}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input ref={search} placeholder={t('capability.search')} />
              <SearchField.ClearButton aria-label={t('packages.clearSearch')} />
            </SearchField.Group>
          </SearchField>
        </motion.div>
      )}
      <div className="library-filter-row">
        <Select
          aria-label={t('capability.source')}
          value={filters.source}
          onChange={(source) => {
            if (source) onFilter({ source: String(source) })
          }}
        >
          <Select.Trigger>
            <Select.Value>
              {t(`library.source.${filters.source as (typeof sources)[number]}`)}
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {sources.map((source) => (
                <ListBox.Item key={source} id={source} textValue={t(`library.source.${source}`)}>
                  {t(`library.source.${source}`)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          aria-label={t('library.type')}
          value={filters.kind}
          onChange={(kind) => {
            if (kind) onFilter({ kind: String(kind) })
          }}
        >
          <Select.Trigger>
            <Select.Value>
              {t(`library.kind.${filters.kind as (typeof kinds)[number]}`)}
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {kinds.map((kind) => (
                <ListBox.Item key={kind} id={kind} textValue={t(`library.kind.${kind}`)}>
                  {t(`library.kind.${kind}`)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      <ToggleButtonGroup
        className="commands-filters library-status-filters"
        aria-label={t('library.status')}
        selectionMode="single"
        disallowEmptySelection
        isDetached
        selectedKeys={[filters.status]}
        onSelectionChange={(keys) => {
          const status = [...keys][0]
          if (status) onFilter({ status: String(status) })
        }}
      >
        {statuses.map((status) => (
          <ToggleButton key={status} id={status}>
            {t(`library.status.${status}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {error && <CommandNotice status="danger">{error}</CommandNotice>}
      <PackageScrollArea className="commands-scroll" label={t('capability.library')} shadowSize={8}>
        {entries.length ? (
          <ListBox
            className="commands-list"
            aria-label={t('capability.library')}
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={selected ? [selected] : []}
            onSelectionChange={(keys) => {
              if (keys === 'all') return
              const entry = entries.find((item) => keys.has(item.id))
              if (entry) onChoose(entry, false)
            }}
          >
            {sources
              .filter(
                (source) => source !== 'all' && entries.some((entry) => entry.source === source),
              )
              .map((source) => (
                <ListBox.Section key={source} className="commands-source-group">
                  <Header className="commands-group-heading">
                    <span>{t(`library.source.${source}`)}</span>
                    <span className="commands-group-count">
                      {entries.filter((entry) => entry.source === source).length}
                    </span>
                  </Header>
                  {entries.filter((entry) => entry.source === source).map(renderEntry)}
                </ListBox.Section>
              ))}
          </ListBox>
        ) : (
          <div className="library-list-empty">
            <CommandEmpty title={t('library.listEmpty')} detail="" />
          </div>
        )}
      </PackageScrollArea>
    </section>
  )
}
