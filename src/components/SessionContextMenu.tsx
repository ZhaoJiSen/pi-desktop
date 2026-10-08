import { Dropdown } from '@heroui/react'
import { Download, Pencil, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { exportSession } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { useWorkspace } from '../store/workspace'

export interface SessionMenuTarget { id: string; x: number; y: number }

export function SessionContextMenu({ target, onClose, onRename, onRemove }: {
  target: SessionMenuTarget; onClose: () => void; onRename: (id: string) => void; onRemove: (id: string) => void
}) {
  const anchor = useRef<HTMLSpanElement>(null)
  const busy = useWorkspace(state => Boolean(state.runningSessionId) || state.connection === 'connecting')
  const removalLocked = useWorkspace(state => state.runningSessionId === target.id || (state.activeSessionId === target.id && (Boolean(state.runningSessionId) || state.connection === 'connecting')))
  const t = useT()
  return <Dropdown isOpen onOpenChange={open => { if (!open) onClose() }}>
    <span ref={anchor} aria-hidden style={{ position: 'fixed', left: target.x, top: target.y, width: 1, height: 1, pointerEvents: 'none' }} />
    <Dropdown.Popover triggerRef={anchor} placement="bottom start" offset={0} className="action-popover">
      <Dropdown.Menu aria-label={t('更多会话操作')} autoFocus="first" onAction={key => {
        onClose()
        if (key === 'rename') onRename(target.id)
        else if (key === 'remove') onRemove(target.id)
        else if (key === 'export') exportSession(target.id)
      }}>
        <Dropdown.Item id="rename" textValue={t('重命名会话')} className="menu-row" isDisabled={busy}><Pencil />{t('重命名会话')}</Dropdown.Item>
        <Dropdown.Item id="export" textValue={t('导出会话')} className="menu-row"><Download />{t('导出会话')}</Dropdown.Item>
        <Dropdown.Item id="remove" textValue={t('移除会话')} className="menu-row" isDisabled={removalLocked}><Trash2 />{t('移除会话')}</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>
}
