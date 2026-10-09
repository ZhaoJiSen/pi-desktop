import { Button } from '@heroui/react'
import { ArrowUpRight, Check, ChevronLeft, Grid2X2, Moon, Search, Sun } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { connectSession } from '../lib/desktop'
import { cost, tokens } from '../lib/utils'
import type { Theme } from '../types'

export function UsageView() {
  const sessions = useWorkspace((state) => state.sessions)
  const session = sessions.find((item) => item.id === useWorkspace.getState().activeSessionId)
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const t = useT()
  const chosen = scope === 'all' ? sessions : session ? [session] : []
  const total = chosen.reduce(
    (sum, item) => ({
      input: sum.input + item.usage.input,
      output: sum.output + item.usage.output,
      cacheRead: sum.cacheRead + item.usage.cacheRead,
      cacheWrite: sum.cacheWrite + item.usage.cacheWrite,
      total: sum.total + item.usage.total,
      cost: sum.cost + item.usage.cost,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0 },
  )
  return (
    <div className="utility-view">
      <div className="view-toolbar">
        <div className="segment">
          <Button
            variant="ghost"
            className={scope === 'current' ? 'active' : ''}
            onPress={() => setScope('current')}
          >
            {t('sessions.current')}
          </Button>
          <Button
            variant="ghost"
            className={scope === 'all' ? 'active' : ''}
            onPress={() => setScope('all')}
          >
            {t('sessions.all')}
          </Button>
        </div>
      </div>
      <dl className="usage-breakdown">
        {(
          [
            ['usage.totalTokens', tokens(total.total)],
            ['usage.estimatedCost', cost(total.cost)],
            ['usage.input', tokens(total.input)],
            ['usage.output', tokens(total.output)],
            ['usage.cacheRead', tokens(total.cacheRead)],
            ['usage.cacheWrite', tokens(total.cacheWrite)],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="table-scroll">
        <table className="usage-table">
          <thead>
            <tr>
              <th>{t('usage.conversation')}</th>
              <th>{t('usage.model')}</th>
              <th>{t('usage.tokens')}</th>
              <th>{t('usage.cost')}</th>
            </tr>
          </thead>
          <tbody>
            {chosen
              .filter((item) => item.messages.length)
              .map((item) => (
                <tr key={item.id}>
                  <td>
                    <Button
                      variant="ghost"
                      onPress={() => useWorkspace.getState().selectSession(item.id)}
                    >
                      {item.title || t('sessions.new')}
                      <ArrowUpRight />
                    </Button>
                  </td>
                  <td>{item.modelKey.split('/').slice(1).join('/') || '—'}</td>
                  <td>{tokens(item.usage.total)}</td>
                  <td>{cost(item.usage.cost)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ExtensionsView() {
  const commands = useWorkspace((state) => state.commands)
  const packages = useWorkspace((state) => state.packages)
  const sessionId = useWorkspace((state) => state.activeSessionId)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'commands' | 'packages'>('commands')
  const [selected, setSelected] = useState<string | null>(null)
  const t = useT()
  const filtered = commands.filter((command) =>
    `${command.name} ${command.description || ''}`.toLowerCase().includes(query.toLowerCase()),
  )
  function insertCommand(name: string) {
    if (!sessionId) return
    useWorkspace.getState().updateSession(sessionId, { draft: `/${name} ` })
    useWorkspace.getState().setView('chat')
  }
  if (selected) {
    const item = commands.find((command) => command.name === selected)
    return (
      <div className="utility-view">
        <Button variant="ghost" className="back-button" onPress={() => setSelected(null)}>
          <ChevronLeft />
          {t('navigation.extensions')}
        </Button>
        <h2 className="command-title">/{item?.name}</h2>
        <p>{item?.description}</p>
        <dl className="command-details">
          <dt>{t('extensions.source')}</dt>
          <dd>{item && t(`extensions.source.${item.source}`)}</dd>
          {item?.sourceInfo?.path && (
            <>
              <dt>{t('extensions.path')}</dt>
              <dd>{item.sourceInfo.path}</dd>
            </>
          )}
        </dl>
        <Button onPress={() => insertCommand(selected)}>{t('extensions.useCommand')}</Button>
      </div>
    )
  }
  return (
    <div className="utility-view">
      <div className="view-toolbar">
        <div className="segment">
          <Button
            variant="ghost"
            className={tab === 'commands' ? 'active' : ''}
            onPress={() => setTab('commands')}
          >
            {t('extensions.commands')}
          </Button>
          <Button
            variant="ghost"
            className={tab === 'packages' ? 'active' : ''}
            onPress={() => setTab('packages')}
          >
            {t('extensions.packages')}
          </Button>
        </div>
        <label className="inline-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('extensions.searchPlaceholder')}
            aria-label={t('common.search')}
          />
        </label>
      </div>
      {tab === 'commands' ? (
        filtered.length ? (
          <div className="extension-list">
            {filtered.map((command) => (
              <Button
                key={`${command.source}-${command.name}`}
                variant="ghost"
                className="extension-row"
                onPress={() => setSelected(command.name)}
              >
                <Grid2X2 />
                <span>
                  <strong>/{command.name}</strong>
                  <small>{command.description || t(`extensions.source.${command.source}`)}</small>
                </span>
                <ArrowUpRight />
              </Button>
            ))}
          </div>
        ) : (
          <div className="utility-empty">
            <Grid2X2 />
            <p>{t('extensions.noCommands')}</p>
            <span>{t('extensions.connectHint')}</span>
          </div>
        )
      ) : (
        <div className="package-list">
          {packages
            .filter((item) => item.source.toLowerCase().includes(query.toLowerCase()))
            .map((item) => (
              <div key={`${item.scope}-${item.source}`} className="package-row">
                <Grid2X2 />
                <span>{item.source}</span>
                <small>
                  {t(
                    item.scope === 'global'
                      ? 'extensions.scope.global'
                      : 'extensions.scope.project',
                  )}
                </small>
              </div>
            ))}
          {!packages.length && (
            <div className="utility-empty">
              <p>{t('extensions.connectHint')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SettingsView() {
  const theme = useWorkspace((state) => state.theme)
  const language = useWorkspace((state) => state.language)
  const executable = useWorkspace((state) => state.piExecutable)
  const active = useWorkspace((state) => state.activeSessionId)
  const connection = useWorkspace((state) => state.connection)
  const running = useWorkspace((state) => state.runningSessionId)
  const setPreference = useWorkspace((state) => state.setPreference)
  const [path, setPath] = useState(executable)
  const [saved, setSaved] = useState(false)
  const t = useT()
  async function save() {
    setPreference({ piExecutable: path.trim() || 'pi' })
    setSaved(true)
    if (active) await connectSession(active, true)
  }
  return (
    <div className="utility-view settings-view">
      <section className="settings-section">
        <h2>{t('settings.appearance')}</h2>
        <div className="theme-options">
          {(['light', 'dark', 'system'] as Theme[]).map((mode) => (
            <Button
              key={mode}
              variant="secondary"
              className={`theme-option ${theme === mode ? 'active' : ''}`}
              onPress={() => setPreference({ theme: mode })}
              aria-pressed={theme === mode}
            >
              {mode === 'dark' ? <Moon /> : <Sun />}
              <span>{t(`settings.theme.${mode}`)}</span>
              {theme === mode && <Check />}
            </Button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h2>{t('settings.language')}</h2>
        <div className="segment">
          <Button
            variant="ghost"
            className={language === 'zh' ? 'active' : ''}
            onPress={() => setPreference({ language: 'zh' })}
          >
            {t('languages.zh')}
          </Button>
          <Button
            variant="ghost"
            className={language === 'en' ? 'active' : ''}
            onPress={() => setPreference({ language: 'en' })}
          >
            {t('languages.en')}
          </Button>
        </div>
      </section>
      <section className="settings-section">
        <h2>{t('settings.executable')}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="field-label">
            <input
              className="field-input"
              aria-label={t('settings.executable')}
              value={path}
              onChange={(event) => {
                setPath(event.target.value)
                setSaved(false)
              }}
              placeholder="pi"
            />
          </label>
          <p className="setting-help">{t('settings.executableHelp')}</p>
          <Button type="submit" isDisabled={Boolean(running) || connection === 'connecting'}>
            {saved ? <Check /> : null}
            {t('settings.saveReconnect')}
          </Button>
        </form>
      </section>
    </div>
  )
}
