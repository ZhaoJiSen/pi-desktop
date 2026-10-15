import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import {
  commandCapability,
  discoverCommands,
  filterCommands,
  type DiscoverableCommand,
} from '../../lib/commands'
import { getPreviewCommands } from '../../lib/fixtures'
import { request, syncSession } from '../../lib/desktop'
import { errorText } from '../../lib/utils'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { navigateToPage } from '../../router/navigation'
import { commandKey, sources } from './model'

const defaultServices = { desktop: isDesktop, discover: discoverCommands, request, syncSession }
export type CommandServices = typeof defaultServices

export function useCommandsPage(services: CommandServices = defaultServices) {
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
  const [searchOpen, setSearchOpen] = useState(false)
  const searchToggle = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<(typeof sources)[number]>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const catalogKey = JSON.stringify([active, connection, executable, language, previewing])
  const [loadedCatalogKey, setLoadedCatalogKey] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const generation = useRef(0)
  const execution = useRef(false)
  const scrollDetail = useRef(false)
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus()
  }, [searchOpen])
  const connected = previewing
    ? Boolean(active)
    : services.desktop && connection === 'connected' && Boolean(active)
  const loading =
    refreshing || (connected && !previewing && !error && loadedCatalogKey !== catalogKey)
  const locked = !connected || Boolean(running) || loading || executing
  const refresh = useCallback(async () => {
    const id = ++generation.current
    setRefreshing(true)
    setError('')
    setActionError('')
    setNotice('')
    try {
      const result = previewing ? getPreviewCommands(language) : await services.discover()
      if (generation.current === id) {
        setCatalog(result)
        setLoadedCatalogKey(catalogKey)
      }
    } catch (e) {
      if (generation.current === id) {
        setCatalog([])
        setError(errorText(e))
      }
    } finally {
      if (generation.current === id) setRefreshing(false)
    }
  }, [previewing, services, language, catalogKey])
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
        setRefreshing(false)
        return
      }
      if (previewing) {
        setCatalog(getPreviewCommands(language))
        setRefreshing(false)
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
    connected && !loading && !error
      ? previewing
        ? catalog
        : [...catalog.filter((c) => c.source === 'builtin'), ...runtimeCommands]
      : []
  const matches = filterCommands(all, query, source, labels)
  const groups = sources
    .filter((value) => value !== 'all')
    .map((value) => ({
      source: value,
      commands: matches.filter((command) => command.source === value),
    }))
    .filter((group) => group.commands.length > 0)
  const filtered = source === 'all' ? groups.flatMap((group) => group.commands) : matches
  const selectedVisible = filtered.some((command) => commandKey(command) === selected)
  const visibleSelected = selectedVisible ? selected : filtered[0] ? commandKey(filtered[0]) : null
  const item = filtered.find((command) => commandKey(command) === visibleSelected) ?? null
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
  function closeSearch() {
    setQuery('')
    setSearchOpen(false)
    searchToggle.current?.focus()
  }
  return {
    connected,
    all,
    filtered,
    groups,
    labels,
    source,
    setSource,
    visibleSelected,
    item,
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
    executing,
    execute,
    open,
    notice,
    actionError,
  }
}

export type CommandsController = ReturnType<typeof useCommandsPage>
