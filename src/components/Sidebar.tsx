import { Button } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChartNoAxesCombined,
  Folder,
  Grid2X2,
  Plus,
  Search,
  Settings,
  SquarePen,
  Terminal,
} from 'lucide-react'
import { navigateToPage } from '../router/navigation'
import { useCurrentPage } from '../router/hooks'
import { useWorkspace } from '../store/workspace'
import { SidebarToggle, WindowControls } from './Chrome'
import { useT } from '../lib/i18n'
import { useState } from 'react'
import { SessionContextMenu, type SessionMenuTarget } from './SessionContextMenu'
import { ProjectRow } from './ProjectRow'
import { SessionRow } from './SessionRow'

interface Props {
  onNew: () => void
  onSearch: () => void
  onProject: () => void
  onRename: (id: string) => void
  onRemove: (id: string) => void
}
export function Sidebar({ onNew, onSearch, onProject, onRename, onRemove }: Props) {
  const [menu, setMenu] = useState<SessionMenuTarget | null>(null)
  const savedProjects = useWorkspace((state) => state.projects)
  const projects = savedProjects
    .filter((project) => !project.hidden)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  const sessions = useWorkspace((state) => state.sessions)
  const active = useWorkspace((state) => state.activeSessionId)
  const running = useWorkspace((state) => state.runningSessionId)
  const connecting = useWorkspace((state) => state.connection === 'connecting')
  const view = useCurrentPage()
  const t = useT()
  const locked = Boolean(running) || connecting
  return (
    <motion.aside
      className="sidebar"
      aria-label={t('sidebar.label')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: 0.1 }}
    >
      <div className="sidebar-chrome" data-tauri-drag-region="deep">
        <WindowControls />
        <SidebarToggle />
      </div>
      <nav className="nav" aria-label={t('navigation.label')}>
        <Button variant="ghost" className="nav-row" onPress={onNew} isDisabled={locked}>
          <SquarePen />
          {t('sessions.new')}
          <span className="shortcut">⌘ N</span>
        </Button>
        <Button variant="ghost" className="nav-row" onPress={onSearch}>
          <Search />
          {t('common.search')}
          <span className="shortcut">⌘ K</span>
        </Button>
        <Button
          variant="ghost"
          className={`nav-row ${view === 'extensions' ? 'nav-active' : ''}`}
          aria-current={view === 'extensions' ? 'page' : undefined}
          onPress={() => void navigateToPage('extensions')}
        >
          <Grid2X2 />
          {t('navigation.extensions')}
        </Button>
        <Button
          variant="ghost"
          className={`nav-row ${view === 'commands' ? 'nav-active' : ''}`}
          aria-current={view === 'commands' ? 'page' : undefined}
          onPress={() => void navigateToPage('commands')}
        >
          <Terminal />
          {t('navigation.commands')}
        </Button>
      </nav>
      <div className="projects">
        <div className="section-label">
          <span>{t('navigation.projects')}</span>
          <Button
            isIconOnly
            variant="ghost"
            className="sidebar-action"
            onPress={onProject}
            isDisabled={locked}
            aria-label={t('projects.add')}
          >
            <Plus />
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {projects.map((project) => {
            const items = sessions
              .filter((session) => session.projectId === project.id)
              .sort(
                (a, b) =>
                  Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
                  b.updatedAt - a.updatedAt,
              )
            return (
              <motion.section
                layout="position"
                key={project.id}
                className="project"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18 }}
              >
                <ProjectRow project={project} count={items.length} />
                <AnimatePresence initial={false}>
                  {!project.collapsed && (
                    <motion.div
                      id={`project-${project.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="session-list"
                    >
                      {items.map((session) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          selected={active === session.id && view === 'chat'}
                          locked={locked}
                          removalLocked={
                            running === session.id || (active === session.id && locked)
                          }
                          onMenu={setMenu}
                          onRemove={onRemove}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )
          })}
        </AnimatePresence>
        {!projects.length && (
          <Button variant="ghost" className="folder-row" onPress={onProject}>
            <Folder />
            <span>{t('projects.openFolder')}</span>
          </Button>
        )}
      </div>
      <div className="sidebar-bottom">
        <Button
          variant="ghost"
          className={`nav-row ${view === 'usage' ? 'nav-active' : ''}`}
          onPress={() => void navigateToPage('usage')}
        >
          <ChartNoAxesCombined />
          {t('navigation.usage')}
        </Button>
        <Button
          variant="ghost"
          className={`nav-row ${view === 'settings' ? 'nav-active' : ''}`}
          onPress={() => void navigateToPage('settings')}
        >
          <Settings />
          {t('navigation.settings')}
        </Button>
      </div>
      {menu && (
        <SessionContextMenu
          key={menu.id}
          target={menu}
          onClose={() => setMenu(null)}
          onRename={onRename}
          onRemove={onRemove}
        />
      )}
    </motion.aside>
  )
}
