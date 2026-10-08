import { Button } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { ChartNoAxesCombined, ChevronDown, ChevronRight, Folder, Grid2X2, MessageSquare, Plus, Search, Send, Settings } from 'lucide-react'
import { useWorkspace } from '../store/workspace'
import { SidebarToggle, WindowControls } from './Chrome'
import { useT } from '../lib/i18n'
import { useState } from 'react'
import { SessionContextMenu, type SessionMenuTarget } from './SessionContextMenu'

interface Props { onNew: () => void; onSearch: () => void; onProject: () => void; onRename: (id: string) => void; onRemove: (id: string) => void }
export function Sidebar({ onNew, onSearch, onProject, onRename, onRemove }: Props) {
  const [menu, setMenu] = useState<SessionMenuTarget | null>(null)
  const projects = useWorkspace(state => state.projects)
  const sessions = useWorkspace(state => state.sessions)
  const active = useWorkspace(state => state.activeSessionId)
  const running = useWorkspace(state => state.runningSessionId)
  const connecting = useWorkspace(state => state.connection === 'connecting')
  const view = useWorkspace(state => state.view)
  const toggleProject = useWorkspace(state => state.toggleProject)
  const selectSession = useWorkspace(state => state.selectSession)
  const setView = useWorkspace(state => state.setView)
  const language = useWorkspace(state => state.language)
  const t = useT()
  const locked = Boolean(running) || connecting
  return <motion.aside className="sidebar" aria-label="项目与会话" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .25, delay: .1 }}>
    <div className="sidebar-chrome" data-tauri-drag-region><WindowControls /><SidebarToggle /></div>
    <nav className="nav" aria-label="主要导航">
      <Button variant="ghost" className="nav-row" onPress={onNew} isDisabled={locked}><Send />{t('新聊天')}<span className="shortcut">⌘ N</span></Button>
      <Button variant="ghost" className="nav-row" onPress={onSearch}><Search />{t('搜索')}<span className="shortcut">⌘ K</span></Button>
      <Button variant="ghost" className={`nav-row ${view === 'extensions' ? 'nav-active' : ''}`} onPress={() => setView('extensions')}><Grid2X2 />{t('扩展')}</Button>
    </nav>
    <div className="projects">
      <div className="section-label"><span>{t('项目')}</span><Button isIconOnly variant="ghost" className="icon-button" onPress={onProject} isDisabled={locked} aria-label={t('添加项目')}><Plus /></Button></div>
      {projects.map(project => {
        const items = sessions.filter(session => session.projectId === project.id).sort((a, b) => b.updatedAt - a.updatedAt)
        return <section key={project.id} className="project">
          <Button variant="ghost" className="folder-row" onPress={() => toggleProject(project.id)} aria-expanded={!project.collapsed} aria-controls={`project-${project.id}`} aria-label={project.name}>
            {project.collapsed ? <ChevronRight className="chevron" /> : <ChevronDown className="chevron" />}<Folder className="folder" /><span className="folder-name" title={project.path}>{project.name}</span><span className="count">{items.length}</span>
          </Button>
          <AnimatePresence initial={false}>
            {!project.collapsed && <motion.div id={`project-${project.id}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }} className="session-list">
              {items.map(session => <Button key={session.id} variant="ghost" className={`session ${active === session.id && view === 'chat' ? 'selected' : ''}`} onPress={() => selectSession(session.id)} isDisabled={locked && active !== session.id} aria-current={active === session.id && view === 'chat' ? 'page' : undefined} aria-label={session.title} aria-haspopup="menu" onContextMenu={event => {
                event.preventDefault(); event.currentTarget.focus()
                setMenu({ id: session.id, x: event.clientX, y: event.clientY })
              }} onKeyDown={event => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                setMenu({ id: session.id, x: rect.left + 12, y: rect.bottom })
              }}>
                {active === session.id && view === 'chat' && <motion.span layoutId="session-selection" className="session-selection" transition={{ duration: .18 }} />}
                <MessageSquare /><span className="session-name" title={session.title}>{session.title === '新聊天' ? t(session.title) : session.title}</span><time dateTime={new Date(session.updatedAt).toISOString()}>{new Date(session.updatedAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}</time>
              </Button>)}
            </motion.div>}
          </AnimatePresence>
        </section>
      })}
      {!projects.length && <Button variant="ghost" className="folder-row" onPress={onProject}><Folder /><span>{t('打开项目文件夹')}</span></Button>}
    </div>
    <div className="sidebar-bottom">
      <Button variant="ghost" className={`nav-row ${view === 'usage' ? 'nav-active' : ''}`} onPress={() => setView('usage')}><ChartNoAxesCombined />{t('用量')}</Button>
      <Button variant="ghost" className={`nav-row ${view === 'settings' ? 'nav-active' : ''}`} onPress={() => setView('settings')}><Settings />{t('设置')}</Button>
    </div>
    {menu && <SessionContextMenu key={menu.id} target={menu} onClose={() => setMenu(null)} onRename={onRename} onRemove={onRemove} />}
  </motion.aside>
}
