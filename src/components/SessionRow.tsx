import { selectChat } from '../router/navigation'
import { Button } from '@heroui/react'
import { MessageSquare, Pin, PinOff, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useT } from '../lib/i18n'
import { useWorkspace } from '../store/workspace'
import type { Session } from '../types'
import type { SessionMenuTarget } from './SessionContextMenu'

export function SessionRow({
  session,
  selected,
  locked,
  removalLocked,
  onMenu,
  onRemove,
}: {
  session: Session
  selected: boolean
  locked: boolean
  removalLocked: boolean
  onMenu: (target: SessionMenuTarget) => void
  onRemove: (id: string) => void
}) {
  const t = useT()
  const title = session.title || t('sessions.new')
  const pinLabel = t(session.pinned ? 'sessions.unpin' : 'sessions.pin')
  return (
    <motion.div
      className={`session-row ${selected ? 'selected' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
    >
      {selected && <span className="session-selection" />}
      <Button
        variant="ghost"
        className="session"
        onPress={() => selectChat(session.id)}
        isDisabled={locked && !selected}
        aria-current={selected ? 'page' : undefined}
        aria-label={title}
        aria-haspopup="menu"
        onContextMenu={(event) => {
          event.preventDefault()
          event.currentTarget.focus()
          onMenu({ id: session.id, x: event.clientX, y: event.clientY })
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          onMenu({ id: session.id, x: rect.left + 12, y: rect.bottom })
        }}
      >
        <MessageSquare />
        <span className="session-name" title={title}>
          {title}
        </span>
      </Button>
      <div className="session-actions">
        <button
          type="button"
          className={`sidebar-action session-pin ${session.pinned ? 'is-pinned' : ''}`}
          aria-label={t(session.pinned ? 'sessions.unpinFor' : 'sessions.pinFor', { title })}
          aria-pressed={Boolean(session.pinned)}
          title={pinLabel}
          onClick={() => useWorkspace.getState().togglePinSession(session.id)}
        >
          {session.pinned ? <PinOff /> : <Pin />}
        </button>
        <button
          type="button"
          className="sidebar-action session-remove"
          aria-label={t('sessions.removeFor', { title })}
          title={t('sessions.remove')}
          disabled={removalLocked}
          onClick={() => onRemove(session.id)}
        >
          <Trash2 />
        </button>
      </div>
    </motion.div>
  )
}
