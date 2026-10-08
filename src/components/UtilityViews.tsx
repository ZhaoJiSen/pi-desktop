import { Button } from '@heroui/react'
import { ArrowUpRight, Check, ChevronLeft, Grid2X2, Moon, Search, Sun } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { connectSession } from '../lib/desktop'
import { cost, tokens } from '../lib/utils'
import type { Theme } from '../types'

export function UsageView() {
  const sessions = useWorkspace(state => state.sessions)
  const session = sessions.find(item => item.id === useWorkspace.getState().activeSessionId)
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const t = useT()
  const chosen = scope === 'all' ? sessions : session ? [session] : []
  const total = chosen.reduce((sum, item) => ({ input: sum.input + item.usage.input, output: sum.output + item.usage.output, cacheRead: sum.cacheRead + item.usage.cacheRead, cacheWrite: sum.cacheWrite + item.usage.cacheWrite, total: sum.total + item.usage.total, cost: sum.cost + item.usage.cost }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0 })
  return <div className="utility-view">
    <div className="view-toolbar"><div className="segment"><Button variant="ghost" className={scope === 'current' ? 'active' : ''} onPress={() => setScope('current')}>{t('当前会话')}</Button><Button variant="ghost" className={scope === 'all' ? 'active' : ''} onPress={() => setScope('all')}>{t('全部会话')}</Button></div></div>
    <dl className="usage-breakdown">{[['总 Token', tokens(total.total)], ['估算费用', cost(total.cost)], ['输入', tokens(total.input)], ['输出', tokens(total.output)], ['缓存读取', tokens(total.cacheRead)], ['缓存写入', tokens(total.cacheWrite)]].map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>
    <div className="table-scroll"><table className="usage-table"><thead><tr><th>{t('会话')}</th><th>{t('模型')}</th><th>Tokens</th><th>{t('费用')}</th></tr></thead><tbody>{chosen.filter(item => item.messages.length).map(item => <tr key={item.id}><td><Button variant="ghost" onPress={() => useWorkspace.getState().selectSession(item.id)}>{item.title}<ArrowUpRight /></Button></td><td>{item.modelKey.split('/').slice(1).join('/') || '—'}</td><td>{tokens(item.usage.total)}</td><td>{cost(item.usage.cost)}</td></tr>)}</tbody></table></div>
  </div>
}

export function ExtensionsView() {
  const commands = useWorkspace(state => state.commands)
  const packages = useWorkspace(state => state.packages)
  const sessionId = useWorkspace(state => state.activeSessionId)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'commands' | 'packages'>('commands')
  const [selected, setSelected] = useState<string | null>(null)
  const t = useT()
  const filtered = commands.filter(command => `${command.name} ${command.description || ''}`.toLowerCase().includes(query.toLowerCase()))
  function insertCommand(name: string) {
    if (!sessionId) return
    useWorkspace.getState().updateSession(sessionId, { draft: `/${name} ` })
    useWorkspace.getState().setView('chat')
  }
  if (selected) {
    const item = commands.find(command => command.name === selected)
    return <div className="utility-view"><Button variant="ghost" className="back-button" onPress={() => setSelected(null)}><ChevronLeft />{t('扩展')}</Button><h2 className="command-title">/{item?.name}</h2><p>{item?.description}</p><dl className="command-details"><dt>Source</dt><dd>{item?.source}</dd>{item?.sourceInfo?.path && <><dt>Path</dt><dd>{item.sourceInfo.path}</dd></>}</dl><Button onPress={() => insertCommand(selected)}>{t('运行命令')}</Button></div>
  }
  return <div className="utility-view">
    <div className="view-toolbar"><div className="segment"><Button variant="ghost" className={tab === 'commands' ? 'active' : ''} onPress={() => setTab('commands')}>{t('命令')}</Button><Button variant="ghost" className={tab === 'packages' ? 'active' : ''} onPress={() => setTab('packages')}>{t('扩展包')}</Button></div><label className="inline-search"><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('搜索命令或扩展…')} aria-label={t('搜索')} /></label></div>
    {tab === 'commands' ? filtered.length ? <div className="extension-list">{filtered.map(command => <Button key={`${command.source}-${command.name}`} variant="ghost" className="extension-row" onPress={() => setSelected(command.name)}><Grid2X2 /><span><strong>/{command.name}</strong><small>{command.description || command.source}</small></span><ArrowUpRight /></Button>)}</div> : <div className="utility-empty"><Grid2X2 /><p>{t('暂无扩展命令')}</p><span>{t('连接 pi 后读取已安装的扩展与命令。')}</span></div> : <div className="package-list">{packages.filter(item => item.source.toLowerCase().includes(query.toLowerCase())).map(item => <div key={`${item.scope}-${item.source}`} className="package-row"><Grid2X2 /><span>{item.source}</span><small>{item.scope}</small></div>)}{!packages.length && <div className="utility-empty"><p>{t('连接 pi 后读取已安装的扩展与命令。')}</p></div>}</div>}
  </div>
}

export function SettingsView() {
  const theme = useWorkspace(state => state.theme)
  const language = useWorkspace(state => state.language)
  const executable = useWorkspace(state => state.piExecutable)
  const active = useWorkspace(state => state.activeSessionId)
  const connection = useWorkspace(state => state.connection)
  const running = useWorkspace(state => state.runningSessionId)
  const setPreference = useWorkspace(state => state.setPreference)
  const [path, setPath] = useState(executable)
  const [saved, setSaved] = useState(false)
  const t = useT()
  async function save() { setPreference({ piExecutable: path.trim() || 'pi' }); setSaved(true); if (active) await connectSession(active, true) }
  return <div className="utility-view settings-view">
    <section className="settings-section"><h2>{t('外观')}</h2><div className="theme-options">{(['light', 'dark', 'system'] as Theme[]).map(mode => <Button key={mode} variant="secondary" className={`theme-option ${theme === mode ? 'active' : ''}`} onPress={() => setPreference({ theme: mode })} aria-pressed={theme === mode}>{mode === 'dark' ? <Moon /> : <Sun />}<span>{t({ light: '浅色', dark: '深色', system: '跟随系统' }[mode])}</span>{theme === mode && <Check />}</Button>)}</div></section>
    <section className="settings-section"><h2>{t('语言')}</h2><div className="segment"><Button variant="ghost" className={language === 'zh' ? 'active' : ''} onPress={() => setPreference({ language: 'zh' })}>简体中文</Button><Button variant="ghost" className={language === 'en' ? 'active' : ''} onPress={() => setPreference({ language: 'en' })}>English</Button></div></section>
    <section className="settings-section"><h2>{t('pi 可执行文件')}</h2><form onSubmit={event => { event.preventDefault(); void save() }}><label className="field-label"><input className="field-input" aria-label={t('pi 可执行文件')} value={path} onChange={event => { setPath(event.target.value); setSaved(false) }} placeholder="pi" /></label><p className="setting-help">{t('默认从系统 PATH 查找 pi，也可以填写完整路径。')}</p><Button type="submit" isDisabled={Boolean(running) || connection === 'connecting'}>{saved ? <Check /> : null}{t('保存并重新连接')}</Button></form></section>
  </div>
}
