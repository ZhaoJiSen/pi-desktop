import {
  Alert,
  Button,
  Card,
  Chip,
  ListBox,
  ScrollShadow,
  SearchField,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Spinner,
} from '@heroui/react'
import { ArrowRight, RotateCw, SearchX, Terminal } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PackageScrollArea } from '../components/extension-packages/PackageScrollArea'
import { ModelSelector } from '../components/ModelSelector'
import { SidebarOption } from '../components/SidebarOption'
import { SidebarLayout } from '../layouts/SidebarLayout'
import { navigateToPage } from '../router/navigation'
import { useT } from '../lib/i18n'
import {
  commandCapability,
  commandSource,
  discoverCommands,
  filterCommands,
  insertCommand,
  type DiscoverableCommand,
} from '../lib/commands'
import { getPreviewCommands } from '../lib/fixtures'
import { commandOrigin } from '../lib/draft'
import { request, syncSession } from '../lib/desktop'
import { errorText } from '../lib/utils'
import { isDesktop, useWorkspace } from '../store/workspace'

const defaultServices = { desktop: isDesktop, discover: discoverCommands, request, syncSession }
const sources = ['all', 'builtin', 'extension', 'prompt', 'skill'] as const
const MotionCard = motion.create(Card)

function commandKey(command: DiscoverableCommand) {
  return `${command.source}:${command.name}:${commandOrigin(command)}`
}

export function CommandsPage({
  services = defaultServices,
}: {
  services?: typeof defaultServices
}) {
  const t = useT()
  const language = useWorkspace((s) => s.language)
  const active = useWorkspace((s) => s.activeSessionId)
  const connection = useWorkspace((s) => s.connection)
  const runtimeCommands = useWorkspace((s) => s.commands)
  const executable = useWorkspace((s) => s.piExecutable)
  const running = useWorkspace((s) => s.runningSessionId)
  const previewing = !services.desktop
  const [catalog, setCatalog] = useState<DiscoverableCommand[]>(() =>
    previewing ? getPreviewCommands(language) : [],
  )
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<(typeof sources)[number]>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [direction, setDirection] = useState(1)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const generation = useRef(0)
  const execution = useRef(false)
  const reducedMotion = useReducedMotion()
  const scrollDetail = useRef(false)
  const connected = previewing
    ? Boolean(active)
    : services.desktop && connection === 'connected' && Boolean(active)
  const locked = !connected || Boolean(running) || loading || executing
  const refresh = useCallback(async () => {
    const id = ++generation.current
    setLoading(true)
    setError('')
    setActionError('')
    setNotice('')
    try {
      const result = previewing ? getPreviewCommands(language) : await services.discover()
      if (generation.current === id) setCatalog(result)
    } catch (e) {
      if (generation.current === id) {
        setCatalog([])
        setError(errorText(e))
      }
    } finally {
      if (generation.current === id) setLoading(false)
    }
  }, [previewing, services, language])
  useEffect(() => {
    const guard = generation
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setSelected(null)
      setError('')
      setActionError('')
      setNotice('')
      if (!connected) {
        setCatalog([])
        setLoading(false)
        return
      }
      if (previewing) {
        setCatalog(getPreviewCommands(language))
        setLoading(false)
        return
      }
      setCatalog([])
      void refresh()
    })
    return () => {
      cancelled = true
      guard.current++
    }
  }, [active, connected, executable, previewing, refresh, language])
  const labels = {
    builtin: t('commands.source.builtin'),
    extension: t('commands.source.extension'),
    prompt: t('commands.source.prompt'),
    skill: t('commands.source.skill'),
  }
  const all: DiscoverableCommand[] =
    connected && !error
      ? previewing
        ? catalog
        : [...catalog.filter((c) => c.source === 'builtin'), ...runtimeCommands]
      : []
  const filtered = filterCommands(all, query, source, labels)
  const selectedVisible = filtered.some((command) => commandKey(command) === selected)
  const visibleSelected = selectedVisible ? selected : filtered[0] ? commandKey(filtered[0]) : null
  const item = filtered.find((command) => commandKey(command) === visibleSelected) ?? null
  const showSource = source === 'all'
  useEffect(() => {
    if (!scrollDetail.current) return
    scrollDetail.current = false
    if (!window.matchMedia('(max-width: 780px)').matches) return
    document.querySelector('.commands-detail')?.scrollIntoView({ block: 'start' })
  }, [visibleSelected])
  async function execute(command: DiscoverableCommand) {
    if (locked || execution.current || commandCapability(command) !== 'execute' || !active) return
    execution.current = true
    const id = generation.current
    setExecuting(true)
    setActionError('')
    setNotice('')
    useWorkspace.setState({ runningSessionId: active })
    try {
      await services.request({ type: 'compact' })
      if (useWorkspace.getState().activeSessionId === active && generation.current === id) {
        await services.syncSession(active)
        if (useWorkspace.getState().activeSessionId === active && generation.current === id)
          setNotice(t('commands.completed'))
      }
    } catch (e) {
      if (useWorkspace.getState().activeSessionId === active && generation.current === id)
        setActionError(errorText(e))
    } finally {
      if (useWorkspace.getState().runningSessionId === active)
        useWorkspace.setState({ runningSessionId: null })
      setExecuting(false)
      execution.current = false
    }
  }
  function choose(command: DiscoverableCommand) {
    const next = filtered.findIndex((entry) => commandKey(entry) === commandKey(command))
    const current = filtered.findIndex((entry) => commandKey(entry) === visibleSelected)
    setDirection(next >= current ? 1 : -1)
    setSelected(commandKey(command))
    setNotice('')
    setActionError('')
    scrollDetail.current = true
  }
  function open(command: DiscoverableCommand) {
    navigateToPage(
      command.name === 'settings' ? 'settings' : command.name === 'session' ? 'usage' : 'chat',
    )
  }
  const hint = item
    ? t(
        commandCapability(item) === 'terminal'
          ? 'commands.terminalOnly'
          : commandCapability(item) === 'insert'
            ? 'commands.reviewParameters'
            : commandCapability(item) === 'execute'
              ? 'commands.compactHint'
              : item.name === 'model'
                ? 'commands.modelHint'
                : 'commands.desktopAction',
      )
    : ''
  return (
    <motion.div
      className={`utility-view commands-view ${connected ? '' : 'is-empty'}`}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {!connected ? (
        <Empty title={t('commands.disconnected')} detail={t('commands.connectHint')} />
      ) : (
        <SidebarLayout
          className="commands-workspace"
          collapseAt={780}
          label={t('layout.resizeCommands')}
          sidebar={
            <section className="commands-browser" aria-label={t('navigation.commands')}>
              <div className="commands-browser-heading">
                <h2 className="commands-browser-title">{t('navigation.commands')}</h2>
                <Chip className="commands-count" size="sm" variant="soft">
                  {filtered.length === all.length
                    ? all.length
                    : `${filtered.length} / ${all.length}`}
                </Chip>
              </div>
              <div className="commands-toolbar">
                <SearchField
                  className="commands-search"
                  aria-label={t('commands.search')}
                  value={query}
                  onChange={setQuery}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={t('common.search')} />
                    <SearchField.ClearButton aria-label={t('packages.clearSearch')} />
                  </SearchField.Group>
                </SearchField>
                <Tooltip delay={400}>
                  <Tooltip.Trigger role="presentation" tabIndex={-1}>
                    <Button
                      isIconOnly
                      variant="ghost"
                      className="commands-refresh"
                      aria-label={t('commands.refresh')}
                      isDisabled={locked}
                      isPending={loading}
                      onPress={() => void refresh()}
                    >
                      <RotateCw />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{t('commands.refresh')}</Tooltip.Content>
                </Tooltip>
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
                      <ListBox.Item
                        key={value}
                        id={value}
                        textValue={t(`commands.source.${value}`)}
                      >
                        {t(`commands.source.${value}`)}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              {error && <CommandNotice status="danger">{error}</CommandNotice>}
              {!loading && !error && !all.some((command) => command.source === 'builtin') && (
                <CommandNotice status="default">{t('commands.catalogUnavailable')}</CommandNotice>
              )}
              <PackageScrollArea className="commands-scroll" label={t('navigation.commands')}>
                {!filtered.length ? (
                  <Empty
                    loading={loading}
                    title={t(
                      loading
                        ? 'commands.loading'
                        : error
                          ? 'commands.loadFailed'
                          : 'commands.empty',
                    )}
                    detail={t(error ? 'commands.retryHint' : 'commands.searchHint')}
                  />
                ) : (
                  <ListBox
                    dependencies={[showSource, language]}
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
                    items={filtered}
                  >
                    {(command) => (
                      <ListBox.Item
                        id={commandKey(command)}
                        textValue={`/${command.name} ${command.description ?? ''}`}
                        className="command-row sidebar-option"
                      >
                        <SidebarOption
                          title={`/${command.name}`}
                          subtitle={command.description}
                          accessory={
                            showSource ? (
                              <span className="command-source-badge">
                                {t(`commands.source.${command.source}`)}
                              </span>
                            ) : undefined
                          }
                        />
                      </ListBox.Item>
                    )}
                  </ListBox>
                )}
              </PackageScrollArea>
            </section>
          }
        >
          {item && (
            <ScrollShadow className="commands-detail" hideScrollBar aria-label={`/${item.name}`}>
              <MotionCard
                key={commandKey(item)}
                variant="transparent"
                className="command-inspector"
                initial={reducedMotion ? false : { opacity: 0, x: direction * 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card.Header>
                  <div className="command-inspector-heading">
                    <Card.Title>/{item.name}</Card.Title>
                    <Chip className="command-source" size="sm" variant="soft">
                      {t(`commands.source.${item.source}`)}
                    </Chip>
                  </div>
                  <Card.Description className="command-summary">
                    {item.description || t('commands.noDescription')}
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <div className="command-usage">
                    <h3>{t('commands.usage')}</h3>
                    <div className="command-syntax">
                      <Terminal aria-hidden="true" />
                      <code>
                        /{item.name}
                        {item.argumentHint ? ` ${item.argumentHint}` : ''}
                      </code>
                    </div>
                  </div>
                  {commandSource(item) && (
                    <div className="command-origin">
                      <h3>{t('commands.origin')}</h3>
                      <p>{commandSource(item)}</p>
                    </div>
                  )}
                </Card.Content>
                <Card.Footer className="command-actions">
                  <p className="commands-hint">{hint}</p>
                  {commandCapability(item) === 'insert' && (
                    <Button isDisabled={locked} onPress={() => insertCommand(item)}>
                      <ArrowRight aria-hidden="true" />
                      {t('commands.insert')}
                    </Button>
                  )}
                  {commandCapability(item) === 'execute' && (
                    <Button
                      isDisabled={locked}
                      isPending={executing}
                      onPress={() => void execute(item)}
                    >
                      {t('commands.execute')}
                    </Button>
                  )}
                  {commandCapability(item) === 'navigate' && item.name === 'model' && (
                    <ModelSelector />
                  )}
                  {commandCapability(item) === 'navigate' && item.name !== 'model' && (
                    <Button isDisabled={locked} onPress={() => open(item)}>
                      <ArrowRight aria-hidden="true" />
                      {t(
                        item.name === 'settings'
                          ? 'navigation.settings'
                          : item.name === 'session'
                            ? 'navigation.usage'
                            : 'commands.openComposer',
                      )}
                    </Button>
                  )}
                  {notice && <CommandNotice status="success">{notice}</CommandNotice>}
                  {actionError && <CommandNotice status="danger">{actionError}</CommandNotice>}
                </Card.Footer>
              </MotionCard>
            </ScrollShadow>
          )}
        </SidebarLayout>
      )}
    </motion.div>
  )
}

function CommandNotice({
  status,
  children,
}: {
  status: 'danger' | 'success' | 'default'
  children: string
}) {
  return (
    <Alert
      status={status}
      className="commands-alert"
      role={status === 'danger' ? 'alert' : 'status'}
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

function Empty({
  title,
  detail,
  loading = false,
}: {
  title: string
  detail: string
  loading?: boolean
}) {
  return (
    <div className="utility-empty" role={loading ? 'status' : undefined}>
      <div className="commands-empty-icon" aria-hidden="true">
        {loading ? <Spinner size="sm" /> : <SearchX />}
      </div>
      <p>{title}</p>
      <span>{detail}</span>
    </div>
  )
}
