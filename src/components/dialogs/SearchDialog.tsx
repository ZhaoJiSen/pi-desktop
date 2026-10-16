import { Button, Modal } from '@heroui/react'
import { useState } from 'react'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import { isRecentProject } from '../../lib/recentProject'
import { selectChat } from '../../router/navigation'
import { Search, MessageSquare, ChevronRight } from 'lucide-react'
import { useDebounce } from 'ahooks'
import { messageText } from '../../lib/utils'

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const search = useDebounce(query.trim().toLowerCase(), { wait: 100 })
  const sessions = useWorkspace((state) => state.sessions)
  const projects = useWorkspace((state) => state.projects)
  const busy = useWorkspace(
    (state) => Boolean(state.runningSessionId) || state.connection === 'connecting',
  )
  const t = useT()
  const projectLabel = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId)
    if (!project) return null
    return isRecentProject(project) ? t('projects.recentChats') : project.name
  }
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
                    <small>{projectLabel(session.projectId)}</small>
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
