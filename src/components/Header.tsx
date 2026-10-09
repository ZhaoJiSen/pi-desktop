import { Button, Dropdown } from '@heroui/react'
import { Download, Ellipsis, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { exportSession } from '../lib/desktop'
import { SidebarToggle, WindowControls } from './Chrome'

export function Header({ onRename }: { onRename: () => void }) {
  const sidebarOpen = useWorkspace((state) => state.sidebarOpen)
  const session = useWorkspace((state) =>
    state.sessions.find((item) => item.id === state.activeSessionId),
  )
  const view = useWorkspace((state) => state.view)
  const running = useWorkspace((state) => state.runningSessionId)
  const connecting = useWorkspace((state) => state.connection === 'connecting')
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useT()
  const title = view === 'chat' ? session?.title || t('sessions.new') : t(`navigation.${view}`)
  return (
    <header className="main-header" data-tauri-drag-region="deep">
      {!sidebarOpen && (
        <div className="collapsed-chrome">
          <WindowControls />
          <SidebarToggle />
        </div>
      )}
      <h1 title={title}>{title}</h1>
      {session && view === 'chat' && (
        <div className="header-actions" data-tauri-drag-region="false">
          <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
            <Button
              isIconOnly
              variant="ghost"
              className="icon-button"
              aria-label={t('sessions.actions')}
            >
              <Ellipsis />
            </Button>
            <Dropdown.Popover placement="bottom end" className="action-popover" offset={8}>
              <Dropdown.Menu
                aria-label={t('sessions.actions')}
                onAction={(key) => {
                  setMenuOpen(false)
                  if (key === 'rename') onRename()
                  else if (key === 'export') exportSession(session.id)
                }}
              >
                <Dropdown.Item
                  id="rename"
                  textValue={t('sessions.rename')}
                  className="menu-row"
                  isDisabled={Boolean(running) || connecting}
                >
                  <Pencil />
                  {t('sessions.rename')}
                </Dropdown.Item>
                <Dropdown.Item id="export" textValue={t('sessions.export')} className="menu-row">
                  <Download />
                  {t('sessions.export')}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      )}
    </header>
  )
}
