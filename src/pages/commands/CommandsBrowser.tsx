import {
  Button,
  Chip,
  Header,
  ListBox,
  SearchField,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@heroui/react'
import { RotateCw, Search, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { PackageScrollArea } from '../../components/extension-packages/PackageScrollArea'
import { SidebarOption } from '../../components/SidebarOption'
import { useT } from '../../lib/i18n'
import type { DiscoverableCommand } from '../../lib/commands'
import { commandKey, sources } from './model'
import { CommandNotice, CommandEmpty } from './CommandFeedback'
import type { CommandsController } from './useCommandsPage'

type Props = Pick<
  CommandsController,
  | 'all'
  | 'filtered'
  | 'groups'
  | 'labels'
  | 'source'
  | 'setSource'
  | 'visibleSelected'
  | 'choose'
  | 'query'
  | 'setQuery'
  | 'searchOpen'
  | 'setSearchOpen'
  | 'searchToggle'
  | 'searchInput'
  | 'closeSearch'
  | 'locked'
  | 'loading'
  | 'error'
  | 'refresh'
>

export function CommandsBrowser({
  all,
  filtered,
  groups,
  labels,
  source,
  setSource,
  visibleSelected,
  choose,
  query,
  setQuery,
  searchOpen,
  setSearchOpen,
  searchToggle,
  searchInput,
  closeSearch,
  locked,
  loading,
  error,
  refresh,
}: Props) {
  const t = useT()
  const reducedMotion = useReducedMotion()
  function renderCommand(command: DiscoverableCommand) {
    return (
      <ListBox.Item
        key={commandKey(command)}
        id={commandKey(command)}
        textValue={`/${command.name} ${command.description ?? ''}`}
        className="command-row sidebar-option"
      >
        <SidebarOption title={`/${command.name}`} subtitle={command.description} />
      </ListBox.Item>
    )
  }
  return (
    <section className="commands-browser" aria-label={t('navigation.commands')}>
      <div className="commands-browser-heading">
        <div className="commands-browser-identity">
          <h2 className="commands-browser-title">{t('navigation.commands')}</h2>
          <Chip className="commands-count" size="sm" variant="soft">
            {filtered.length === all.length ? all.length : `${filtered.length} / ${all.length}`}
          </Chip>
        </div>
        <div className="commands-tools">
          <Tooltip delay={400}>
            <Button
              ref={searchToggle}
              isIconOnly
              variant="ghost"
              className="commands-tool-button commands-search-toggle"
              aria-label={searchOpen ? t('packages.closeSearch') : t('commands.search')}
              aria-expanded={searchOpen}
              aria-controls="commands-browser-search"
              onPress={() => {
                if (searchOpen) closeSearch()
                else setSearchOpen(true)
              }}
            >
              {searchOpen ? <X /> : <Search />}
            </Button>
            <Tooltip.Content>
              {searchOpen ? t('packages.closeSearch') : t('commands.search')}
            </Tooltip.Content>
          </Tooltip>
          <Tooltip delay={400}>
            <Button
              isIconOnly
              variant="ghost"
              className="commands-tool-button commands-refresh"
              aria-label={t('commands.refresh')}
              isDisabled={locked}
              isPending={loading}
              onPress={() => void refresh()}
            >
              <RotateCw />
            </Button>
            <Tooltip.Content>{t('commands.refresh')}</Tooltip.Content>
          </Tooltip>
        </div>
      </div>
      <ToggleButtonGroup
        className="commands-filters"
        aria-label={t('commands.filter')}
        selectionMode="single"
        disallowEmptySelection
        isDetached
        selectedKeys={[source]}
        onSelectionChange={(keys) => {
          const key = [...keys][0]
          if (key != null) setSource(key as (typeof sources)[number])
        }}
      >
        {sources.map((value) => (
          <ToggleButton key={value} id={value} aria-label={t(`commands.source.${value}`)}>
            {t(`commands.sourceShort.${value}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Select
        className="commands-source-select"
        aria-label={t('commands.filter')}
        value={source}
        onChange={(value) => {
          if (value != null) setSource(value as (typeof sources)[number])
        }}
      >
        <Select.Trigger>
          <span className="commands-source-label">{t('commands.filter')}</span>
          <Select.Value>{t(`commands.sourceShort.${source}`)}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox aria-label={t('commands.filter')}>
            {sources.map((value) => (
              <ListBox.Item key={value} id={value} textValue={t(`commands.source.${value}`)}>
                {t(`commands.source.${value}`)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            id="commands-browser-search"
            className="commands-search-reveal"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
          >
            <div className="commands-toolbar">
              <SearchField
                className="commands-search"
                aria-label={t('commands.search')}
                value={query}
                onChange={setQuery}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeSearch()
                  }
                }}
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input ref={searchInput} placeholder={t('common.search')} />
                  <SearchField.ClearButton aria-label={t('packages.clearSearch')} />
                </SearchField.Group>
              </SearchField>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <CommandNotice status="danger">{error}</CommandNotice>}
      {!loading && !error && !all.some((command) => command.source === 'builtin') && (
        <CommandNotice status="default">{t('commands.catalogUnavailable')}</CommandNotice>
      )}
      <PackageScrollArea className="commands-scroll" label={t('navigation.commands')}>
        {!filtered.length ? (
          <CommandEmpty
            loading={loading}
            title={t(
              loading ? 'commands.loading' : error ? 'commands.loadFailed' : 'commands.empty',
            )}
            detail={t(error ? 'commands.retryHint' : 'commands.searchHint')}
          />
        ) : (
          <ListBox
            className="commands-list"
            aria-label={t('navigation.commands')}
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={visibleSelected ? [visibleSelected] : []}
            onSelectionChange={(keys) => {
              if (keys === 'all') return
              const command = filtered.find((entry) => keys.has(commandKey(entry)))
              if (command) choose(command)
            }}
          >
            {source === 'all'
              ? groups.map((group) => (
                  <ListBox.Section key={group.source} className="commands-source-group">
                    <Header className="commands-group-heading">
                      <span>{labels[group.source]}</span>
                      <span className="commands-group-count">{group.commands.length}</span>
                    </Header>
                    {group.commands.map(renderCommand)}
                  </ListBox.Section>
                ))
              : filtered.map(renderCommand)}
          </ListBox>
        )}
      </PackageScrollArea>
    </section>
  )
}
