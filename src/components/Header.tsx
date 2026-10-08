import { Button, Popover } from '@heroui/react'
import { Download, Ellipsis, FileText, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { shortPath } from '../lib/utils'
import { useT } from '../lib/i18n'
import { exportSession } from '../lib/desktop'
import { SidebarToggle, WindowControls } from './Chrome'

export function Header({ onRename }: { onRename: () => void }) {
  const sidebarOpen = useWorkspace(state => state.sidebarOpen)
  const session = useWorkspace(state => state.sessions.find(item => item.id === state.activeSessionId))
  const project = useWorkspace(state => state.projects.find(item => item.id === session?.projectId))
  const view = useWorkspace(state => state.view)
  const running = useWorkspace(state => state.runningSessionId)
  const connecting = useWorkspace(state => state.connection === 'connecting')
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useT()
  const title = view === 'chat' ? session?.title || '新聊天' : { usage: '用量', extensions: '扩展', settings: '设置' }[view]
  return <header className="main-header" data-tauri-drag-region>
    {!sidebarOpen && <div className="collapsed-chrome"><WindowControls /><SidebarToggle /></div>}
    <h1 title={title}>{t(title)}</h1>
    {project && view === 'chat' && <span className="path" title={project.path}>{shortPath(project.path)}</span>}
    {session && view === 'chat' && <div className="header-actions">
      <Button isIconOnly variant="ghost" className="icon-button" aria-label={t('导出会话')} onPress={() => exportSession()}><FileText /></Button>
      <Popover isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Button isIconOnly variant="ghost" className="icon-button" aria-label={t('更多会话操作')}><Ellipsis /></Button>
        <Popover.Content placement="bottom end" className="action-popover"><Popover.Dialog aria-label={t('更多会话操作')}>
          <Button variant="ghost" className="menu-row" isDisabled={Boolean(running) || connecting} onPress={() => { setMenuOpen(false); onRename() }}><Pencil />{t('重命名会话')}</Button>
          <Button variant="ghost" className="menu-row" onPress={() => { setMenuOpen(false); exportSession() }}><Download />{t('导出会话')}</Button>
        </Popover.Dialog></Popover.Content>
      </Popover>
    </div>}
  </header>
}
