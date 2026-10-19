import { Accordion, Button, Separator, Tooltip } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Search, SquarePen, Terminal } from 'lucide-react'
import { useCurrentPage } from '../router/hooks'
import { useWorkspace } from '../store/workspace'
import { selectSessionSummaries } from '../store/sessionSelectors'
import { useT } from '../lib/i18n'
import { useState } from 'react'
import { SessionContextMenu, type SessionMenuTarget } from './SessionContextMenu'
import { isRecentProject, RECENT_PROJECT_ID } from '../lib/recentProject'
import type { Project } from '../types'
import { ProjectRow } from './ProjectRow'
import { RecentSection } from './RecentSection'
import { SessionRow } from './SessionRow'
import { ProjectPicker } from './ProjectPicker'

interface Props {
  onSearch: () => void
  onNew: () => void
  onProject: () => void
  onRename: (id: string) => void
  onRemove: (id: string) => void
}
export function Sidebar({ onSearch, onNew, onProject, onRename, onRemove }: Props) {
  const [menu, setMenu] = useState<SessionMenuTarget | null>(null)
  const savedProjects = useWorkspace((state) => state.projects)
  const recentCollapsed = useWorkspace((state) => state.recentCollapsed)
  const recentSaved = savedProjects.find((project) => isRecentProject(project))
  const recent: Project = recentSaved ?? {
    id: RECENT_PROJECT_ID,
    name: '',
    path: '',
    branch: null,
    collapsed: recentCollapsed,
    builtin: 'recent',
  }
  const projects = savedProjects
    .filter((project) => !project.hidden && !isRecentProject(project))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  const sessions = useWorkspace(selectSessionSummaries)
  const active = useWorkspace((state) => state.activeSessionId)
  const running = useWorkspace((state) => state.runningSessionId)
  const connecting = useWorkspace((state) => state.connection === 'connecting')
  const view = useCurrentPage()
  const t = useT()
  const locked = Boolean(running) || connecting
  return (
    <aside className="sidebar" aria-label={t('sidebar.label')}>
      <div className="sidebar-chrome" data-tauri-drag-region="deep">
        <span className="sidebar-title">Pi Desktop</span>
        <Tooltip delay={450}>
          <Tooltip.Trigger role="presentation" tabIndex={-1}>
            <Button
              isIconOnly
              variant="ghost"
              className="sidebar-action sidebar-search"
              aria-label={t('common.search')}
              onPress={onSearch}
              data-tauri-drag-region="false"
            >
              <Search />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content placement="right" offset={10}>
            {t('common.search')} · ⌘ K
          </Tooltip.Content>
        </Tooltip>
      </div>
      <nav className="nav" aria-label={t('sessions.actions')}>
        <Button
          variant="ghost"
          className="nav-row list-box-item"
          onPress={onNew}
          isDisabled={locked}
        >
          <SquarePen />
          {t('sessions.new')}
        </Button>
        <Button variant="ghost" className="nav-row list-box-item" isDisabled>
          <Terminal />
          {t('navigation.terminal')}
        </Button>
      </nav>
      <Separator className="sidebar-nav-separator" />
      <div className="projects">
        <RecentSection project={recent} onMenu={setMenu} onRemove={onRemove} />
        <Accordion hideSeparator defaultExpandedKeys={['projects']}>
          <Accordion.Item id="projects">
            <div className="section-label">
              <Accordion.Heading className="projects-heading">
                <Accordion.Trigger className="projects-toggle">
                  <span>{t('navigation.projects')}</span>
                  <Accordion.Indicator className="projects-indicator">
                    <ChevronRight />
                  </Accordion.Indicator>
                </Accordion.Trigger>
              </Accordion.Heading>
              <ProjectPicker onBrowse={onProject} isDisabled={locked} />
            </div>
            <Accordion.Panel>
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
                            {!items.length && (
                              <p className="session-list-empty">{t('sessions.empty')}</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.section>
                  )
                })}
              </AnimatePresence>
              {!projects.length && <p className="projects-empty">{t('projects.emptyTitle')}</p>}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
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
    </aside>
  )
}
