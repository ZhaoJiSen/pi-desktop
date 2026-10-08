import { Button, Modal } from '@heroui/react'
import { Search, MessageSquare, ChevronRight } from 'lucide-react'
import { useDebounce } from 'ahooks'
import { useEffect, useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { extensionResponse, removeSession, renameSession } from '../lib/desktop'
import { errorText, messageText } from '../lib/utils'
import type { ExtensionRequest } from '../types'

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const search = useDebounce(query.trim().toLowerCase(), { wait: 100 })
  const sessions = useWorkspace(state => state.sessions)
  const projects = useWorkspace(state => state.projects)
  const select = useWorkspace(state => state.selectSession)
  const busy = useWorkspace(state => Boolean(state.runningSessionId) || state.connection === 'connecting')
  const t = useT()
  const results = sessions.filter(session => `${session.title} ${session.messages.map(message => messageText(message.blocks)).join(' ')}`.toLowerCase().includes(search)).sort((a, b) => b.updatedAt - a.updatedAt)
  return <Modal.Backdrop isOpen={open} onOpenChange={value => { if (!value) { onClose(); setQuery('') } }} className="dialog-backdrop"><Modal.Container size="md" placement="top"><Modal.Dialog className="search-dialog" aria-label={t('搜索会话')}>
    <Modal.Header><Modal.Heading className="sr-only">{t('搜索会话')}</Modal.Heading><label className="search-field"><Search /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={t('搜索标题或对话内容…')} aria-label={t('搜索会话')} /><kbd>esc</kbd></label></Modal.Header>
    <Modal.Body className="search-results">{results.length ? results.map(session => <Button key={session.id} variant="ghost" className="search-result" isDisabled={busy} onPress={() => { select(session.id); onClose(); setQuery('') }}><MessageSquare /><span><span>{session.title}</span><small>{projects.find(project => project.id === session.projectId)?.name}</small></span><ChevronRight /></Button>) : <div className="popover-empty">{t('没有匹配的会话')}</div>}</Modal.Body>
  </Modal.Dialog></Modal.Container></Modal.Backdrop>
}

export function ProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [path, setPath] = useState('')
  const t = useT()
  function add() {
    const normalized = path.trim().replace(/\/+$/, '')
    if (!normalized || (!normalized.startsWith('/') && !normalized.startsWith('~/'))) return
    const store = useWorkspace.getState()
    const project = store.addProject(normalized)
    store.createSession(project); onClose(); setPath('')
  }
  return <Modal.Backdrop isOpen={open} onOpenChange={value => { if (!value) onClose() }} className="dialog-backdrop"><Modal.Container size="sm"><Modal.Dialog className="form-dialog">
    <Modal.Header><Modal.Heading>{t('添加项目')}</Modal.Heading><Modal.CloseTrigger /></Modal.Header>
    <Modal.Body><form id="project-form" onSubmit={event => { event.preventDefault(); add() }}><label className="field-label">{t('项目路径')}<input className="field-input" value={path} onChange={event => setPath(event.target.value)} placeholder="~/Projects/my-project" required autoFocus pattern="(/|~/).*" /></label></form></Modal.Body>
    <Modal.Footer><Button variant="ghost" onPress={onClose}>{t('取消')}</Button><Button type="submit" form="project-form">{t('打开项目文件夹')}</Button></Modal.Footer>
  </Modal.Dialog></Modal.Container></Modal.Backdrop>
}

export function RenameDialog({ sessionId, open, onClose }: { sessionId: string; open: boolean; onClose: () => void }) {
  const session = useWorkspace(state => state.sessions.find(item => item.id === sessionId))
  const [name, setName] = useState(session?.title || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = useT()
  async function save() {
    if (!session || !name.trim()) return
    setSaving(true); setError('')
    try { await renameSession(session.id, name); onClose() } catch (error) { setError(errorText(error)) } finally { setSaving(false) }
  }
  return <Modal.Backdrop isOpen={open} onOpenChange={value => { if (!value && !saving) onClose() }} className="dialog-backdrop"><Modal.Container size="sm"><Modal.Dialog className="form-dialog">
    <Modal.Header><Modal.Heading>{t('重命名会话')}</Modal.Heading><Modal.CloseTrigger /></Modal.Header>
    <Modal.Body><form id="rename-form" onSubmit={event => { event.preventDefault(); void save() }}><label className="field-label">{t('名称')}<input className="field-input" autoFocus maxLength={100} value={name} required onChange={event => setName(event.target.value)} /></label>{error && <p className="field-error" role="alert">{error}</p>}</form></Modal.Body>
    <Modal.Footer><Button variant="ghost" onPress={onClose} isDisabled={saving}>{t('取消')}</Button><Button type="submit" form="rename-form" isPending={saving} isDisabled={!name.trim()}>{t('保存')}</Button></Modal.Footer>
  </Modal.Dialog></Modal.Container></Modal.Backdrop>
}

export function RemoveSessionDialog({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const session = useWorkspace(state => state.sessions.find(item => item.id === sessionId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = useT()
  async function remove() {
    setSaving(true); setError('')
    try { await removeSession(sessionId); onClose() } catch (error) { setError(errorText(error)) } finally { setSaving(false) }
  }
  return <Modal.Backdrop isOpen onOpenChange={value => { if (!value && !saving) onClose() }} className="dialog-backdrop"><Modal.Container size="sm"><Modal.Dialog className="form-dialog">
    <Modal.Header><Modal.Heading>{t('移除会话')}</Modal.Heading><Modal.CloseTrigger isDisabled={saving} /></Modal.Header>
    <Modal.Body><p>{session?.title}</p><p>{t('移除桌面端会话记录及草稿，保留 pi 原始会话文件。')}</p>{error && <p className="field-error" role="alert">{error}</p>}</Modal.Body>
    <Modal.Footer><Button variant="ghost" onPress={onClose} isDisabled={saving}>{t('取消')}</Button><Button onPress={() => void remove()} isPending={saving}>{t('移除会话')}</Button></Modal.Footer>
  </Modal.Dialog></Modal.Container></Modal.Backdrop>
}

export function ExtensionDialog({ current, onClose }: { current: ExtensionRequest; onClose: () => void }) {
  const [value, setValue] = useState(current.prefill || '')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const t = useT()
  async function respond(payload: Record<string, unknown>) {
    if (sending) return
    setSending(true)
    try { await extensionResponse(current.id, payload); onClose() } catch (error) { setError(errorText(error)); setSending(false) }
  }
  useEffect(() => {
    if (!current.timeout) return
    const timer = setTimeout(() => { void extensionResponse(current.id, { cancelled: true }).catch(() => {}); onClose() }, current.timeout)
    return () => clearTimeout(timer)
  }, [current.id, current.timeout, onClose])
  return <Modal.Backdrop isOpen onOpenChange={open => { if (!open) void respond({ cancelled: true }) }} className="dialog-backdrop"><Modal.Container size="md"><Modal.Dialog className="form-dialog">
    <Modal.Header><Modal.Heading>{current.title}</Modal.Heading><Modal.CloseTrigger /></Modal.Header>
    <Modal.Body>{current.message && <p>{current.message}</p>}{current.method === 'select' ? current.options?.map(option => <Button key={option} variant="ghost" className="menu-row" onPress={() => void respond({ value: option })} isDisabled={sending}>{option}</Button>) : current.method !== 'confirm' && <textarea className="field-input extension-input" autoFocus aria-label={current.title} placeholder={current.placeholder} value={value} onChange={event => setValue(event.target.value)} />}{error && <p className="field-error" role="alert">{error}</p>}</Modal.Body>
    <Modal.Footer><Button variant="ghost" onPress={() => void respond(current.method === 'confirm' ? { confirmed: false } : { cancelled: true })}>{t('取消')}</Button>{current.method !== 'select' && <Button isPending={sending} onPress={() => void respond(current.method === 'confirm' ? { confirmed: true } : { value })}>{t('保存')}</Button>}</Modal.Footer>
  </Modal.Dialog></Modal.Container></Modal.Backdrop>
}
