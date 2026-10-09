import { Dropdown } from '@heroui/react'
import { Download, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { exportSession } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { useWorkspace } from '../store/workspace'

export interface SessionMenuTarget {
  id: string
  x: number
  y: number
}

export function SessionContextMenu({
  target,
  onClose,
  onRename,
  onRemove,
}: {
  target: SessionMenuTarget
  onClose: () => void
  onRename: (id: string) => void
  onRemove: (id: string) => void
}) {
  const anchor = useRef<HTMLSpanElement>(null)
  const busy = useWorkspace(
    (state) => Boolean(state.runningSessionId) || state.connection === 'connecting',
  )
  const removalLocked = useWorkspace(
    (state) =>
      state.runningSessionId === target.id ||
      (state.activeSessionId === target.id &&
        (Boolean(state.runningSessionId) || state.connection === 'connecting')),
  )
  const t = useT()
  const pinned = useWorkspace((state) =>
    Boolean(state.sessions.find((session) => session.id === target.id)?.pinned),
  )
  return (
    <Dropdown
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <span
        ref={anchor}
        aria-hidden
        style={{
          position: 'fixed',
          left: target.x,
          top: target.y,
          width: 1,
          height: 1,
          pointerEvents: 'none',
        }}
      />
      <Dropdown.Popover
        triggerRef={anchor}
        placement="bottom start"
        offset={0}
        className="action-popover"
      >
        <Dropdown.Menu
          aria-label={t('sessions.actions')}
          autoFocus="first"
          onAction={(key) => {
            onClose()
            if (key === 'rename') onRename(target.id)
            else if (key === 'remove') onRemove(target.id)
            else if (key === 'export') exportSession(target.id)
            else if (key === 'pin') useWorkspace.getState().togglePinSession(target.id)
          }}
        >
          <Dropdown.Item
            id="pin"
            textValue={t(pinned ? 'sessions.unpin' : 'sessions.pin')}
            className="menu-row"
          >
            {pinned ? <PinOff /> : <Pin />}
            {t(pinned ? 'sessions.unpin' : 'sessions.pin')}
          </Dropdown.Item>
          <Dropdown.Item
            id="rename"
            textValue={t('sessions.rename')}
            className="menu-row"
            isDisabled={busy}
          >
            <Pencil />
            {t('sessions.rename')}
          </Dropdown.Item>
          <Dropdown.Item id="export" textValue={t('sessions.export')} className="menu-row">
            <Download />
            {t('sessions.export')}
          </Dropdown.Item>
          <Dropdown.Item
            id="remove"
            textValue={t('sessions.remove')}
            className="menu-row"
            isDisabled={removalLocked}
          >
            <Trash2 />
            {t('sessions.remove')}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
