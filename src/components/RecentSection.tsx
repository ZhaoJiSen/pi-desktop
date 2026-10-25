import { Button } from '@heroui/react'
import { ChevronRight, SquarePen, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { createChat } from '../router/navigation'
import { useCurrentPage } from '../router/hooks'
import { useT } from '../lib/i18n'
import { openRecentProject } from '../lib/recent'
import { isRecentProject } from '../lib/recentProject'
import { errorText } from '../lib/utils'
import { useWorkspace } from '../store/workspace'
import { selectSessionSummaries } from '../store/sessionSelectors'
import type { Project } from '../types'
import type { SessionMenuTarget } from './SessionContextMenu'
import { SessionList } from './SessionList'

export function RecentSection({
  project,
  onMenu,
  onRemove,
}: {
  project: Project
  onMenu: (target: SessionMenuTarget) => void
  onRemove: (id: string) => void
}) {
  const [error, setError] = useState('')
  const sessions = useWorkspace(selectSessionSummaries)
  const active = useWorkspace((state) => state.activeSessionId)
  const running = useWorkspace((state) => state.runningSessionId)
  const connecting = useWorkspace((state) => state.connection === 'connecting')
  const view = useCurrentPage()
  const t = useT()
  const locked = Boolean(running) || connecting
  const label = t('projects.recentChats')
  const items = sessions
    .filter((session) => session.projectId === project.id)
    .sort(
      (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt,
    )
  function toggle() {
    const store = useWorkspace.getState()
    if (!store.projects.some((item) => isRecentProject(item))) {
      store.toggleRecentCollapsed()
      return
    }
    store.toggleProject(project.id)
  }
  async function newSession() {
    const store = useWorkspace.getState()
    if (store.runningSessionId || store.connection === 'connecting') return
    try {
      createChat(await openRecentProject())
    } catch (reason) {
      setError(errorText(reason))
    }
  }
  return (
    <section className="recent-section" aria-labelledby="recent-heading">
      <div className="section-label">
        <button
          id="recent-heading"
          type="button"
          className="projects-toggle recent-toggle"
          onClick={toggle}
          aria-expanded={!project.collapsed}
          aria-controls="recent-sessions"
        >
          <span>{label}</span>
          <ChevronRight
            className="projects-indicator"
            data-expanded={project.collapsed ? undefined : true}
          />
        </button>
        <button
          type="button"
          className="sidebar-action section-action"
          aria-label={t('projects.createSessionFor', { project: label })}
          onClick={() => void newSession()}
          disabled={locked}
        >
          <SquarePen />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!project.collapsed && (
          <motion.div
            id="recent-sessions"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="session-list recent-sessions"
          >
            <SessionList
              items={items}
              active={view === 'chat' ? active : null}
              running={running}
              locked={locked}
              onMenu={onMenu}
              onRemove={onRemove}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <div className="project-error recent-error" role="alert">
          <span>{error}</span>
          <Button
            isIconOnly
            variant="ghost"
            className="icon-button"
            aria-label={t('common.close')}
            onPress={() => setError('')}
          >
            <X />
          </Button>
        </div>
      )}
    </section>
  )
}
