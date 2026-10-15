import { Button, ListBox, Popover, SearchField, Separator, Spinner } from '@heroui/react'
import { ArrowRight, Folder, FolderOpen, GitFork, Plus } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { openProject, pickProject } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { projectPath } from '../lib/projectPaths'
import { errorText } from '../lib/utils'
import { navigateToPage } from '../router/navigation'
import { isDesktop, useWorkspace } from '../store/workspace'
import { repositoryUrl } from '../lib/repositories'
import { CloneRepositoryDialog } from './CloneRepositoryDialog'

export function ProjectPicker({
  onBrowse,
  isDisabled,
}: {
  onBrowse: () => void
  isDisabled: boolean
}) {
  const projects = useWorkspace((state) => state.projects)
  const sessions = useWorkspace((state) => state.sessions)
  const updating = useWorkspace((state) => state.piUpdating)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [cloneUrl, setCloneUrl] = useState<string | null>(null)
  const errorId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const locked = isDisabled || updating || pending
  const search = query.trim().toLowerCase()
  const path = projectPath(query)
  const remote = repositoryUrl(query)
  const latestActivity = new Map<string, number>()
  for (const session of sessions) {
    latestActivity.set(
      session.projectId,
      Math.max(latestActivity.get(session.projectId) || 0, session.updatedAt),
    )
  }
  const filtered = projects
    .filter((project) => `${project.name} ${project.path}`.toLowerCase().includes(search))
    .sort((a, b) => (latestActivity.get(b.id) || 0) - (latestActivity.get(a.id) || 0))
  const knownPath = path && projects.some((project) => project.path === path)

  function changeOpen(value: boolean) {
    if (pending) return
    setOpen(value)
    if (!value) {
      setQuery('')
      setError('')
    }
  }

  async function choose(path: string) {
    if (locked) return
    setPending(true)
    setError('')
    try {
      if (await openProject(path)) {
        void navigateToPage('chat')
        setOpen(false)
        setQuery('')
      }
    } catch (error) {
      setError(errorText(error))
    } finally {
      setPending(false)
    }
  }

  async function browse() {
    if (locked) return
    if (!isDesktop) {
      changeOpen(false)
      onBrowse()
      return
    }
    setPending(true)
    setError('')
    try {
      if (await pickProject()) {
        void navigateToPage('chat')
        setOpen(false)
        setQuery('')
      }
    } catch (error) {
      setError(errorText(error))
    } finally {
      setPending(false)
    }
  }

  function showClone(url = '') {
    if (locked) return
    changeOpen(false)
    setCloneUrl(url)
  }

  return (
    <>
      <Popover isOpen={open} onOpenChange={changeOpen}>
        <Button
          isIconOnly
          variant="ghost"
          className="sidebar-action project-picker-trigger"
          isDisabled={locked}
          aria-label={t('projects.add')}
        >
          <Plus />
        </Button>
        <Popover.Content className="project-picker" placement="bottom start" offset={8}>
          <Popover.Dialog aria-label={t('projects.add')}>
            <div className="project-picker-header">
              <Popover.Heading>{t('projects.add')}</Popover.Heading>
              {pending && <Spinner size="sm" aria-label={t('projects.opening')} />}
            </div>
            <SearchField
              className="project-picker-search"
              aria-label={t('projects.searchOrPath')}
              value={query}
              isDisabled={locked}
              isInvalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onChange={(value) => {
                setQuery(value)
                setError('')
              }}
              onSubmit={() => {
                if (remote) showClone(remote)
                else if (path) void choose(path)
              }}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  autoFocus
                  placeholder={t('projects.searchOrPath')}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && listRef.current) {
                      event.preventDefault()
                      listRef.current.focus()
                    }
                  }}
                />
                <SearchField.ClearButton aria-label={t('projects.clearSearch')} />
              </SearchField.Group>
            </SearchField>
            {error && (
              <p className="project-picker-error" role="alert" id={errorId}>
                {error}
              </p>
            )}
            {filtered.length > 0 && <p className="project-picker-label">{t('projects.recent')}</p>}
            {(filtered.length > 0 || (path && !knownPath) || remote) && (
              <ListBox
                ref={listRef}
                className="project-picker-list"
                aria-label={t('projects.add')}
                selectionMode="none"
                onAction={(key) => {
                  const target = filtered.find((project) => project.id === key)
                  if (target) void choose(target.path)
                  else if (key === 'open-path' && path) void choose(path)
                  else if (key === 'clone-repository' && remote) showClone(remote)
                }}
              >
                {filtered.map((project) => (
                  <ListBox.Item
                    key={project.id}
                    id={project.id}
                    textValue={`${project.name} ${project.path}`}
                    className="project-picker-option"
                    isDisabled={locked || !project.hidden}
                  >
                    <Folder />
                    <span className="project-picker-copy" title={project.path}>
                      <span>{project.name}</span>
                      <small>{project.path}</small>
                    </span>
                    {!project.hidden && (
                      <span className="project-picker-status">{t('projects.added')}</span>
                    )}
                  </ListBox.Item>
                ))}
                {path && !knownPath && (
                  <ListBox.Item
                    id="open-path"
                    textValue={t('projects.openPath')}
                    className="project-picker-option"
                    isDisabled={locked}
                  >
                    <FolderOpen />
                    <span className="project-picker-copy" title={path}>
                      <span>{t('projects.openPath')}</span>
                      <small>{path}</small>
                    </span>
                    <ArrowRight />
                  </ListBox.Item>
                )}
                {remote && (
                  <ListBox.Item
                    id="clone-repository"
                    textValue={t('clone.shortcut')}
                    className="project-picker-option"
                    isDisabled={locked}
                  >
                    <GitFork />
                    <span className="project-picker-copy" title={remote}>
                      <span>{t('clone.shortcut')}</span>
                      <small>{remote}</small>
                    </span>
                    <ArrowRight />
                  </ListBox.Item>
                )}
              </ListBox>
            )}
            {search && !filtered.length && !path && !remote && (
              <p className="project-picker-empty">{t('projects.noMatches')}</p>
            )}
            <Separator className="project-picker-separator" />
            <Button
              variant="ghost"
              className="project-picker-browse"
              onPress={() => void browse()}
              isDisabled={locked}
            >
              <FolderOpen />
              <span>{t('projects.browse')}</span>
              <ArrowRight />
            </Button>
            <Button
              variant="ghost"
              className="project-picker-browse"
              onPress={() => showClone()}
              isDisabled={locked}
            >
              <GitFork />
              <span>{t('clone.action')}</span>
              <ArrowRight />
            </Button>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      {cloneUrl !== null && (
        <CloneRepositoryDialog initialUrl={cloneUrl} onClose={() => setCloneUrl(null)} />
      )}
    </>
  )
}
