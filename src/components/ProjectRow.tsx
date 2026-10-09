import { createChat } from '../router/navigation'
import { Button, Dropdown, Separator, Tooltip } from '@heroui/react'
import {
  Ellipsis,
  Folder,
  FolderOpen,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  SquarePen,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { revealProject } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { errorText, shortPath } from '../lib/utils'
import { useWorkspace } from '../store/workspace'
import type { Project } from '../types'
import { RenameProjectDialog } from './RenameProjectDialog'

export function ProjectRow({ project, count }: { project: Project; count: number }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [error, setError] = useState('')
  const locked = useWorkspace(
    (state) => Boolean(state.runningSessionId) || state.connection === 'connecting',
  )
  const t = useT()
  function newSession() {
    const store = useWorkspace.getState()
    if (!store.runningSessionId && store.connection !== 'connecting') createChat(project.id)
  }
  return (
    <>
      <div className="project-heading list-box-item" data-menu-open={menuOpen || undefined}>
        <Tooltip delay={650} closeDelay={100} isDisabled={menuOpen}>
          <Tooltip.Trigger<'button'>
            render={(props) => <button {...props} type="button" />}
            className="button folder-row"
            onClick={() => useWorkspace.getState().toggleProject(project.id)}
            aria-expanded={!project.collapsed}
            aria-controls={`project-${project.id}`}
            aria-label={project.name}
          >
            {project.collapsed ? <Folder className="folder" /> : <FolderOpen className="folder" />}
            <span className="folder-name">{project.name}</span>
            {project.pinned && <Pin className="project-pin" aria-label={t('projects.pinned')} />}
          </Tooltip.Trigger>
          <Tooltip.Content placement="right top" offset={12} className="project-summary">
            <div className="project-summary-title">
              <Folder />
              <strong>{project.name}</strong>
              {project.pinned && <Pin />}
            </div>
            <div className="project-summary-count">
              <MessageSquare />
              <span>
                {t(count === 1 ? 'projects.sessionCount.one' : 'projects.sessionCount.other', {
                  count,
                })}
              </span>
            </div>
            <div className="project-summary-path">
              <FolderOpen />
              <span>{shortPath(project.path)}</span>
            </div>
          </Tooltip.Content>
        </Tooltip>
        <div className="project-actions">
          <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
            <Button
              isIconOnly
              variant="ghost"
              className="sidebar-action project-more"
              aria-label={t('projects.actionsFor', { project: project.name })}
            >
              <Ellipsis />
            </Button>
            <Dropdown.Popover
              placement="bottom start"
              offset={6}
              className="action-popover project-menu"
            >
              <Dropdown.Menu
                aria-label={t('projects.operationsFor', { project: project.name })}
                onAction={(key) => {
                  setMenuOpen(false)
                  setError('')
                  if (key === 'new') newSession()
                  else if (key === 'rename') setRenaming(true)
                  else if (key === 'pin') useWorkspace.getState().togglePinProject(project.id)
                  else if (key === 'reveal')
                    void revealProject(project.path).catch((error) => setError(errorText(error)))
                  else if (key === 'remove') useWorkspace.getState().removeProject(project.id)
                }}
              >
                <Dropdown.Section aria-label={t('projects.menu.conversations')}>
                  <Dropdown.Item
                    id="new"
                    textValue={t('sessions.create')}
                    className="menu-row"
                    isDisabled={locked}
                  >
                    <SquarePen />
                    {t('sessions.create')}
                  </Dropdown.Item>
                </Dropdown.Section>
                <Separator />
                <Dropdown.Section aria-label={t('projects.menu.manage')}>
                  <Dropdown.Item id="rename" textValue={t('projects.rename')} className="menu-row">
                    <Pencil />
                    {t('projects.rename')}
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="pin"
                    textValue={t(project.pinned ? 'projects.unpin' : 'projects.pin')}
                    className="menu-row"
                  >
                    {project.pinned ? <PinOff /> : <Pin />}
                    {t(project.pinned ? 'projects.unpin' : 'projects.pin')}
                  </Dropdown.Item>
                  <Dropdown.Item id="reveal" textValue={t('projects.reveal')} className="menu-row">
                    <FolderOpen />
                    {t('projects.reveal')}
                  </Dropdown.Item>
                </Dropdown.Section>
                <Separator />
                <Dropdown.Section aria-label={t('projects.remove')}>
                  <Dropdown.Item
                    id="remove"
                    textValue={t('projects.remove')}
                    className="menu-row project-remove"
                  >
                    <X />
                    {t('projects.remove')}
                  </Dropdown.Item>
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <button
            type="button"
            className="sidebar-action"
            aria-label={t('projects.createSessionFor', { project: project.name })}
            onClick={newSession}
            disabled={locked}
          >
            <SquarePen />
          </button>
        </div>
      </div>
      {renaming && (
        <RenameProjectDialog projectId={project.id} onClose={() => setRenaming(false)} />
      )}
      {error && (
        <div className="project-error" role="alert">
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
    </>
  )
}
