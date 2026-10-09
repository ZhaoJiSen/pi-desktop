import { selectChat } from '../router/navigation'
import { Button, Tooltip } from '@heroui/react'
import { Pin, PinOff, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useT } from '../lib/i18n'
import { useWorkspace } from '../store/workspace'
import type { Session } from '../types'
import type { SessionMenuTarget } from './SessionContextMenu'
import { useTextTruncated } from '../hooks/useTextTruncated'

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
  const { ref: titleRef, truncated } = useTextTruncated(title)
  const pinLabel = t(session.pinned ? 'sessions.unpin' : 'sessions.pin')
  return (
    <motion.div
      className={`session-row list-box-item ${selected ? 'selected' : ''}`}
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
        <Tooltip delay={450} closeDelay={100} isDisabled={!truncated}>
          <Tooltip.Trigger<'span'>
            render={(props) => <span {...props} />}
            className="session-name"
            role={undefined}
            tabIndex={-1}
          >
            <span ref={titleRef} className="session-title">
              {title}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content placement="top start" offset={4}>
            {title}
          </Tooltip.Content>
        </Tooltip>
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
