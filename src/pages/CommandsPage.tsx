import { Button } from '@heroui/react'
import { ArrowUpRight, ChevronRight, Play, RotateCw, Search, Terminal } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ModelSelector } from '../components/ModelSelector'
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
import { request, syncSession } from '../lib/desktop'
import { errorText } from '../lib/utils'
import { isDesktop, useWorkspace } from '../store/workspace'

const defaultServices = { desktop: isDesktop, discover: discoverCommands, request, syncSession }
export function CommandsPage({
  services = defaultServices,
}: {
  services?: typeof defaultServices
}) {
  const t = useT()
  const active = useWorkspace((s) => s.activeSessionId)
  const connection = useWorkspace((s) => s.connection)
  const runtimeCommands = useWorkspace((s) => s.commands)
  const executable = useWorkspace((s) => s.piExecutable)
  const running = useWorkspace((s) => s.runningSessionId)
  const [catalog, setCatalog] = useState<DiscoverableCommand[]>([])
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const generation = useRef(0)
  const connected = services.desktop && connection === 'connected' && Boolean(active)
  const locked = !connected || Boolean(running) || loading || executing
  const refresh = useCallback(async () => {
    const id = ++generation.current
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const result = await services.discover()
      if (generation.current === id) setCatalog(result)
    } catch (e) {
      if (generation.current === id) {
        setCatalog([])
        setError(errorText(e))
      }
    } finally {
      if (generation.current === id) setLoading(false)
    }
  }, [services])
  useEffect(() => {
    const guard = generation
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setCatalog([])
      setSelected(null)
      setError('')
      setNotice('')
      if (connected) void refresh()
      else setLoading(false)
    })
    return () => {
      cancelled = true
      guard.current++
    }
  }, [active, connected, executable, refresh])
  const all: DiscoverableCommand[] =
    connected && !error
      ? [...catalog.filter((c) => c.source === 'builtin'), ...runtimeCommands]
      : []
  const filtered = filterCommands(all, query, source, {
    builtin: t('commands.source.builtin'),
    extension: t('commands.source.extension'),
    prompt: t('commands.source.prompt'),
    skill: t('commands.source.skill'),
  })
  const key = (c: DiscoverableCommand) => `${c.source}:${c.name}:${commandSource(c)}`
  const item = all.find((c) => key(c) === selected)
  async function execute(command: DiscoverableCommand) {
    if (locked || commandCapability(command) !== 'execute' || !active) return
    setExecuting(true)
    setError('')
    setNotice('')
    useWorkspace.setState({ runningSessionId: active })
    try {
      await services.request({ type: 'compact' })
      if (useWorkspace.getState().activeSessionId === active) {
        await services.syncSession(active)
        setNotice(t('commands.completed'))
      }
    } catch (e) {
      setError(errorText(e))
    } finally {
      if (useWorkspace.getState().runningSessionId === active)
        useWorkspace.setState({ runningSessionId: null })
      setExecuting(false)
    }
  }
  return (
    <motion.div
      className="utility-view commands-view"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="commands-toolbar">
        <label className="inline-search">
          <Search />
          <input
            aria-label={t('commands.search')}
            placeholder={t('commands.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <Button
          variant="ghost"
          isDisabled={locked}
          isPending={loading}
          onPress={() => void refresh()}
        >
          <RotateCw />
          {t('commands.refresh')}
        </Button>
      </div>
      <div className="commands-filters" role="group" aria-label={t('commands.filter')}>
        {(['all', 'builtin', 'extension', 'prompt', 'skill'] as const).map((value) => (
          <Button
            key={value}
            variant="ghost"
            aria-pressed={source === value}
            onPress={() => setSource(value)}
            className={source === value ? 'active' : ''}
          >
            {t(`commands.source.${value}`)}
          </Button>
        ))}
      </div>
      {error && (
        <p className="commands-alert" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {connected && !loading && !error && !all.some((c) => c.source === 'builtin') && (
        <p className="commands-hint">{t('commands.catalogUnavailable')}</p>
      )}
      {!connected || !filtered.length ? (
        <div className="utility-empty">
          <Terminal />
          <p>
            {t(
              !connected
                ? 'commands.disconnected'
                : loading
                  ? 'commands.loading'
                  : error
                    ? 'commands.loadFailed'
                    : 'commands.empty',
            )}
          </p>
          <span>
            {t(
              !connected
                ? 'commands.connectHint'
                : error
                  ? 'commands.retryHint'
                  : 'commands.searchHint',
            )}
          </span>
        </div>
      ) : (
        <div className={`commands-layout ${item ? 'has-detail' : ''}`}>
          <div className="commands-list" aria-label={t('navigation.commands')}>
            {filtered.map((command) => (
              <Button
                key={key(command)}
                variant="ghost"
                className={`command-row ${selected === key(command) ? 'active' : ''}`}
                aria-pressed={selected === key(command)}
                onPress={() => {
                  setSelected(key(command))
                  setNotice('')
                }}
              >
                <span className="command-row-copy">
                  <strong>/{command.name}</strong>
                  <span>{command.description || t('commands.noDescription')}</span>
                  <small>
                    {t(`commands.source.${command.source}`)}
                    {commandSource(command) && ` · ${commandSource(command)}`}
                  </small>
                </span>
                <ChevronRight />
              </Button>
            ))}
          </div>
          {item && (
            <motion.section
              key={key(item)}
              className="command-inspector"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.16 }}
              aria-label={`/${item.name}`}
            >
              <span className="commands-hint">{t(`commands.source.${item.source}`)}</span>
              <h2>/{item.name}</h2>
              <p>{item.description || t('commands.noDescription')}</p>
              {commandSource(item) && (
                <dl>
                  <dt>{t('commands.origin')}</dt>
                  <dd>{commandSource(item)}</dd>
                </dl>
              )}
              <h3>{t('commands.usage')}</h3>
              <code>
                /{item.name}
                {item.argumentHint ? ` ${item.argumentHint}` : ''}
              </code>
              <p className="commands-hint">
                {t(
                  commandCapability(item) === 'terminal'
                    ? 'commands.terminalOnly'
                    : commandCapability(item) === 'insert'
                      ? 'commands.reviewParameters'
                      : commandCapability(item) === 'execute'
                        ? 'commands.compactHint'
                        : item.name === 'model'
                          ? 'commands.modelHint'
                          : 'commands.desktopAction',
                )}
              </p>
              {commandCapability(item) === 'insert' && (
                <Button isDisabled={locked} onPress={() => insertCommand(item)}>
                  <ArrowUpRight />
                  {t('commands.insert')}
                </Button>
              )}
              {commandCapability(item) === 'execute' && (
                <Button
                  isDisabled={locked}
                  isPending={executing}
                  onPress={() => void execute(item)}
                >
                  <Play />
                  {t('commands.execute')}
                </Button>
              )}
              {commandCapability(item) === 'navigate' && item.name === 'model' && <ModelSelector />}
              {commandCapability(item) === 'navigate' && item.name !== 'model' && (
                <Button
                  isDisabled={locked}
                  onPress={() =>
                    navigateToPage(
                      item.name === 'settings'
                        ? 'settings'
                        : item.name === 'session'
                          ? 'usage'
                          : 'chat',
                    )
                  }
                >
                  <ArrowUpRight />
                  {t(
                    item.name === 'settings'
                      ? 'navigation.settings'
                      : item.name === 'session'
                        ? 'navigation.usage'
                        : 'commands.openComposer',
                  )}
                </Button>
              )}
            </motion.section>
          )}
        </div>
      )}
    </motion.div>
  )
}
