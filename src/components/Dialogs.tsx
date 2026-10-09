import { createChat, selectChat } from '../router/navigation'
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
  const sessions = useWorkspace((state) => state.sessions)
  const projects = useWorkspace((state) => state.projects)
  const busy = useWorkspace(
    (state) => Boolean(state.runningSessionId) || state.connection === 'connecting',
  )
  const t = useT()
  const results = sessions
    .filter((session) =>
      `${session.title || t('sessions.new')} ${session.messages.map((message) => messageText(message.blocks)).join(' ')}`
        .toLowerCase()
        .includes(search),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose()
          setQuery('')
        }
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="md" placement="top">
        <Modal.Dialog className="search-dialog" aria-label={t('sessions.search')}>
          <Modal.Header>
            <Modal.Heading className="sr-only">{t('sessions.search')}</Modal.Heading>
            <label className="search-field">
              <Search />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('sessions.searchPlaceholder')}
                aria-label={t('sessions.search')}
              />
              <kbd>esc</kbd>
            </label>
          </Modal.Header>
          <Modal.Body className="search-results">
            {results.length ? (
              results.map((session) => (
                <Button
                  key={session.id}
                  variant="ghost"
                  className="search-result"
                  isDisabled={busy}
                  onPress={() => {
                    selectChat(session.id)
                    onClose()
                    setQuery('')
                  }}
                >
                  <MessageSquare />
                  <span>
                    <span>{session.title || t('sessions.new')}</span>
                    <small>
                      {projects.find((project) => project.id === session.projectId)?.name}
                    </small>
                  </span>
                  <ChevronRight />
                </Button>
              ))
            ) : (
              <div className="popover-empty">{t('sessions.noResults')}</div>
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

export function ProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [path, setPath] = useState('')
  const t = useT()
  function add() {
    const normalized = path.trim().replace(/\/+$/, '')
    if (!normalized || (!normalized.startsWith('/') && !normalized.startsWith('~/'))) return
    const store = useWorkspace.getState()
    const project = store.addProject(normalized)
    createChat(project)
    onClose()
    setPath('')
  }
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="form-dialog">
          <Modal.Header>
            <Modal.Heading>{t('projects.add')}</Modal.Heading>
            <Modal.CloseTrigger aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            <form
              id="project-form"
              onSubmit={(event) => {
                event.preventDefault()
                add()
              }}
            >
              <label className="field-label">
                {t('projects.path')}
                <input
                  className="field-input"
                  value={path}
                  onChange={(event) => setPath(event.target.value)}
                  placeholder="~/Projects/my-project"
                  required
                  autoFocus
                  pattern="(/|~/).*"
                />
              </label>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="project-form">
              {t('projects.openFolder')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

export function RenameDialog({
  sessionId,
  open,
  onClose,
}: {
  sessionId: string
  open: boolean
  onClose: () => void
}) {
  const session = useWorkspace((state) => state.sessions.find((item) => item.id === sessionId))
  const [name, setName] = useState(session?.title || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = useT()
  async function save() {
    if (!session || !name.trim()) return
    setSaving(true)
    setError('')
    try {
      await renameSession(session.id, name)
      onClose()
    } catch (error) {
      setError(errorText(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !saving) onClose()
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="form-dialog rename-dialog">
          <Modal.Header>
            <Modal.Heading>{t('sessions.rename')}</Modal.Heading>
            <Modal.CloseTrigger aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            <form
              id="rename-form"
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
            >
              <label className="field-label">
                {t('common.name')}
                <input
                  className="field-input"
                  autoFocus
                  maxLength={100}
                  value={name}
                  required
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" className="rename-cancel" onPress={onClose} isDisabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              className="rename-save"
              type="submit"
              form="rename-form"
              isPending={saving}
              isDisabled={!name.trim()}
            >
              {t('common.save')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

export function RemoveSessionDialog({
  sessionId,
  onClose,
}: {
  sessionId: string
  onClose: () => void
}) {
  const session = useWorkspace((state) => state.sessions.find((item) => item.id === sessionId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = useT()
  async function remove() {
    setSaving(true)
    setError('')
    try {
      await removeSession(sessionId)
      onClose()
    } catch (error) {
      setError(errorText(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(value) => {
        if (!value && !saving) onClose()
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="form-dialog remove-session-dialog">
          <Modal.Header>
            <Modal.Heading>{t('sessions.remove')}</Modal.Heading>
            <Modal.CloseTrigger isDisabled={saving} aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            <p>{session?.title || t('sessions.new')}</p>
            <p>{t('sessions.removeDescription')}</p>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" className="remove-cancel" onPress={onClose} isDisabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              className="remove-confirm"
              onPress={() => void remove()}
              isPending={saving}
            >
              {t('sessions.remove')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

export function ExtensionDialog({
  current,
  onClose,
}: {
  current: ExtensionRequest
  onClose: () => void
}) {
  const [value, setValue] = useState(current.prefill || '')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const t = useT()
  async function respond(payload: Record<string, unknown>) {
    if (sending) return
    setSending(true)
    try {
      await extensionResponse(current.id, payload)
      onClose()
    } catch (error) {
      setError(errorText(error))
      setSending(false)
    }
  }
  useEffect(() => {
    if (!current.timeout) return
    const timer = setTimeout(() => {
      void extensionResponse(current.id, { cancelled: true }).catch(() => {})
      onClose()
    }, current.timeout)
    return () => clearTimeout(timer)
  }, [current.id, current.timeout, onClose])
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) void respond({ cancelled: true })
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="md">
        <Modal.Dialog className="form-dialog">
          <Modal.Header>
            <Modal.Heading>{current.title}</Modal.Heading>
            <Modal.CloseTrigger aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            {current.message && <p>{current.message}</p>}
            {current.method === 'select'
              ? current.options?.map((option) => (
                  <Button
                    key={option}
                    variant="ghost"
                    className="menu-row"
                    onPress={() => void respond({ value: option })}
                    isDisabled={sending}
                  >
                    {option}
                  </Button>
                ))
              : current.method !== 'confirm' && (
                  <textarea
                    className="field-input extension-input"
                    autoFocus
                    aria-label={current.title}
                    placeholder={current.placeholder}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="ghost"
              onPress={() =>
                void respond(
                  current.method === 'confirm' ? { confirmed: false } : { cancelled: true },
                )
              }
            >
              {t('common.cancel')}
            </Button>
            {current.method !== 'select' && (
              <Button
                isPending={sending}
                onPress={() =>
                  void respond(current.method === 'confirm' ? { confirmed: true } : { value })
                }
              >
                {t('common.save')}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
