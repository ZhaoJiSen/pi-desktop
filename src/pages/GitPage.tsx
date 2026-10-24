import { Button, Dropdown } from '@heroui/react'
import { ChevronDown, FolderGit2, GitCommitHorizontal, History, RotateCw } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Activity, useState } from 'react'
import { ChangesPane } from '../components/source/ChangesView'
import { useSource } from '../components/source/context'
import { GitHistoryWorkspace } from '../components/source/GitHistoryWorkspace'
import { SourceAction } from '../components/source/SourceAction'
import { ProjectSourceContext, useProjectSource } from '../components/source/useProjectSource'
import { useT } from '../lib/i18n'
import { useWorkspace } from '../store/workspace'
import { GitBranchPicker } from '../components/source/GitBranchPicker'
import { GitNavigationLayoutProvider } from '../components/source/GitNavigationSplit'

export function GitPage() {
  const t = useT()
  const projects = useWorkspace((state) => state.projects)
  const current = useProjectSource()
  const source = useSource()
  const [projectId, setProjectId] = useState<string | null>(null)
  const project =
    projects.find((item) => item.id === projectId) ??
    projects.find((item) => item.path === source?.workspaceRequest.projectPath) ??
    projects.find((item) => item.path === current.path) ??
    projects[0]
  const [view, setView] = useState<'changes' | 'history'>(
    source?.workspaceRequest.tab === 'history' ? 'history' : 'changes',
  )
  const [handled, setHandled] = useState(source?.workspaceRequest.nonce)
  if (handled !== source?.workspaceRequest.nonce) {
    setHandled(source?.workspaceRequest.nonce)
    setView(source?.workspaceRequest.tab === 'history' ? 'history' : 'changes')
    setProjectId(null)
  }
  const [tick, setTick] = useState(0)
  const reduced = useReducedMotion()
  const path = project?.path ?? ''
  const requestMatchesProject =
    !source?.workspaceRequest.projectPath || source.workspaceRequest.projectPath === path
  const historyPath = requestMatchesProject ? (source?.workspaceRequest.historyPath ?? null) : null
  function navigation(count?: number) {
    return (
      <div className="git-workspace-navigation">
        <div className="git-repository-context">
          <Dropdown>
            <Button variant="ghost" className="git-project-picker" aria-label={t('source.project')}>
              <FolderGit2 />
              <span title={project?.name}>{project?.name ?? t('source.noProject')}</span>
              <ChevronDown />
            </Button>
            <Dropdown.Popover className="action-popover">
              <Dropdown.Menu
                aria-label={t('source.project')}
                selectionMode="single"
                selectedKeys={project ? [project.id] : []}
                onAction={(key) => setProjectId(String(key))}
              >
                {projects.map((item) => (
                  <Dropdown.Item key={item.id} id={item.id} textValue={item.name}>
                    <span>{item.name}</span>
                    <small>{item.path}</small>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <span className="git-context-divider" aria-hidden="true">
            /
          </span>
          <GitBranchPicker
            key={path}
            projectPath={path}
            tick={tick}
            onChanged={() => setTick((value) => value + 1)}
          />
          <SourceAction label={t('source.refresh')} onPress={() => setTick((value) => value + 1)}>
            <RotateCw />
          </SourceAction>
        </div>
        <nav className="git-view-nav" aria-label={t('source.gitViews')}>
          {(['changes', 'history'] as const).map((id) => (
            <Button
              key={id}
              variant="ghost"
              aria-current={view === id ? 'page' : undefined}
              onPress={() => setView(id)}
            >
              {view === id && (
                <motion.span
                  layoutId="git-view-selection"
                  className="git-view-selection"
                  transition={{ duration: reduced ? 0 : 0.2 }}
                />
              )}
              {id === 'changes' ? <GitCommitHorizontal /> : <History />}
              <span>{t(`source.${id}`)}</span>
              {id === 'changes' && count !== undefined && (
                <span className="git-nav-count">{count}</span>
              )}
            </Button>
          ))}
        </nav>
      </div>
    )
  }
  return (
    <ProjectSourceContext.Provider value={{ path, name: project?.name ?? '' }}>
      <motion.div
        className="git-page"
        initial={reduced ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <h1 className="git-page-title">{t('source.workspace')}</h1>
        <GitNavigationLayoutProvider>
          <div className="git-page-body" key={path}>
            <Activity mode={view === 'changes' ? 'visible' : 'hidden'}>
              <div className="git-view-pane">
                <ChangesPane
                  workspace
                  navigation={navigation}
                  tick={tick}
                  requestNonce={source?.workspaceRequest.nonce ?? 0}
                  initialPath={
                    requestMatchesProject && source?.workspaceRequest.tab === 'changes'
                      ? (source.workspaceRequest.path ?? null)
                      : null
                  }
                  fallbackLabel=""
                />
              </div>
            </Activity>
            <Activity mode={view === 'history' ? 'visible' : 'hidden'}>
              <div className="git-view-pane">
                <GitHistoryWorkspace
                  key={historyPath ?? 'all'}
                  navigation={navigation()}
                  projectPath={path}
                  tick={tick}
                  historyPath={historyPath}
                  onRepositoryChanged={() => setTick((value) => value + 1)}
                />
              </div>
            </Activity>
          </div>
        </GitNavigationLayoutProvider>
      </motion.div>
    </ProjectSourceContext.Provider>
  )
}
