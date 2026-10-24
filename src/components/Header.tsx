import { OverflowTooltip } from './OverflowTooltip'
import { Button, Dropdown } from '@heroui/react'
import { Download, Ellipsis, GitCompare, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useCurrentPage } from '../router/hooks'
import { useWorkspace } from '../store/workspace'
import { useShallow } from 'zustand/react/shallow'
import { useT } from '../lib/i18n'
import { exportSession } from '../lib/desktop'
import { useSource } from './source/context'

export function Header({ onRename }: { onRename: () => void }) {
  const session = useWorkspace(
    useShallow((state) => {
      const current = state.sessions.find((item) => item.id === state.activeSessionId)
      return current ? { id: current.id, title: current.title } : undefined
    }),
  )
  const view = useCurrentPage()
  const running = useWorkspace((state) => state.runningSessionId)
  const connecting = useWorkspace((state) => state.connection === 'connecting')
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useT()
  const source = useSource()
  const title = view === 'chat' ? session?.title || t('sessions.new') : t(`navigation.${view}`)
  return (
    <header className="main-header" data-tauri-drag-region="deep">
      <h1>
        <OverflowTooltip text={title} />
      </h1>
      {session && view === 'chat' && (
        <div className="header-actions" data-tauri-drag-region="false">
          <Button
            isIconOnly
            variant="ghost"
            className="icon-button source-toggle"
            aria-label={t('source.toggle')}
            aria-pressed={Boolean(source?.open)}
            onPress={() => source?.toggle()}
          >
            <GitCompare />
          </Button>
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
