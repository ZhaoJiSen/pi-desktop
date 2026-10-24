import { Button, Dropdown } from '@heroui/react'
import { ChevronDown, FolderGit2, GitCommitHorizontal, History } from 'lucide-react'
import {
  Activity,
  Suspense,
  createContext,
  lazy,
  memo,
  useCallback,
  useContext,
  useDeferredValue,
  useMemo,
  useState,
} from 'react'
import { useSource } from '../components/source/context'
import { ProjectSourceContext, useProjectSource } from '../components/source/useProjectSource'
import { useT } from '../lib/i18n'
import { useWorkspace } from '../store/workspace'
import { GitRemoteSync } from '../components/source/GitRemoteSync'
import { GitBranchPicker } from '../components/source/GitBranchPicker'
import { OverflowTooltip } from '../components/OverflowTooltip'
import { HoverScrollArea } from '../components/HoverScrollArea'
import { GitNavigationLayoutProvider } from '../components/source/GitNavigationSplit'
import { GitWorkspaceLoading } from '../components/source/GitWorkspaceSkeleton'
import {
  GitRepositoryStatusProvider,
  useGitRepositoryStatus,
} from '../components/source/GitRepositoryStatus'
import type { Project } from '../types'

const ChangesPane = lazy(() =>
  import('../components/source/ChangesView').then((module) => ({
    default: memo(module.ChangesPane),
  })),
)
const GitHistoryWorkspace = lazy(() =>
  import('../components/source/GitHistoryWorkspace').then((module) => ({
    default: memo(module.GitHistoryWorkspace),
  })),
)
const ViewContext = createContext<{
  view: 'changes' | 'history'
  setView: (view: 'changes' | 'history') => void
} | null>(null)

function WorkspaceNavigation({
  project,
  projects,
  tick,
  onProjectChange,
  onRefresh,
}: {
  project: Project | undefined
  projects: Project[]
  tick: number
  onProjectChange: (id: string) => void
  onRefresh: () => void
}) {
  const t = useT()
  const path = project?.path ?? ''
  return (
    <>
      <div className="git-workspace-context">
        <div className="git-repository-context">
          <div className="git-repository-switcher">
            <Dropdown>
              <Button
                variant="ghost"
                className="git-project-picker"
                aria-label={t('source.project')}
              >
                <FolderGit2 />
                <OverflowTooltip text={project?.name ?? t('source.noProject')} />
                <ChevronDown />
              </Button>
              <Dropdown.Popover
                className="action-popover git-context-popover git-project-popover"
                placement="bottom start"
                offset={8}
              >
                <div className="git-context-popover-heading" aria-hidden="true">
                  <span>{t('source.project')}</span>
                  <small>{projects.length}</small>
                </div>
                <HoverScrollArea
                  className="git-context-picker-scroll"
                  label={t('source.project')}
                  shadowSize={16}
                >
                  <Dropdown.Menu
                    aria-label={t('source.project')}
                    selectionMode="single"
                    selectedKeys={project ? [project.id] : []}
                    onAction={(key) => onProjectChange(String(key))}
                  >
                    {projects.map((item) => (
                      <Dropdown.Item
                        key={item.id}
                        id={item.id}
                        textValue={item.name}
                        className="git-repository-option"
                      >
                        <FolderGit2 className="git-repository-option-icon" />
                        <span className="git-repository-option-label">
                          <OverflowTooltip text={item.name} />
                          <OverflowTooltip as="small" text={item.path} />
                        </span>
                        <span className="git-repository-option-indicator">
                          <Dropdown.ItemIndicator />
                        </span>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </HoverScrollArea>
              </Dropdown.Popover>
            </Dropdown>
            <span className="git-context-divider" aria-hidden="true" />
            <GitBranchPicker key={path} projectPath={path} tick={tick} onChanged={onRefresh} />
          </div>
        </div>
      </div>
    </>
  )
}

function WorkspaceViews() {
  const t = useT()
  const { view, setView } = useContext(ViewContext)!
  const repository = useGitRepositoryStatus()
  const count = repository?.status.data?.repo ? repository.status.data.files.length : undefined
  return (
    <nav className="git-view-nav" aria-label={t('source.gitViews')}>
      {(['changes', 'history'] as const).map((id) => (
        <Button
          key={id}
          variant="ghost"
          aria-current={view === id ? 'page' : undefined}
          onPress={() => setView(id)}
        >
          {view === id && <span className="git-view-selection" />}
          {id === 'changes' ? <GitCommitHorizontal /> : <History />}
          <span>{t(`source.${id}`)}</span>
          {id === 'changes' && count !== undefined && (
            <span className="git-nav-count">{count}</span>
          )}
        </Button>
      ))}
    </nav>
  )
}

export function GitPage() {
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
  const path = project?.path ?? ''
  const requestMatchesProject =
    !source?.workspaceRequest.projectPath || source.workspaceRequest.projectPath === path
  const historyPath = requestMatchesProject ? (source?.workspaceRequest.historyPath ?? null) : null
  const refresh = useCallback(() => setTick((value) => value + 1), [])
  const [remoteTick, setRemoteTick] = useState(0)
  const fetched = useCallback(() => setRemoteTick((value) => value + 1), [])
  const navigation = useCallback(() => null, [])
  const viewContext = useMemo(() => ({ view, setView }), [view])
  const activeView = useDeferredValue(view)
  const projectContext = useMemo(() => ({ path, name: project?.name ?? '' }), [path, project?.name])

  return (
    <ViewContext.Provider value={viewContext}>
      <GitRepositoryStatusProvider
        projectPath={path}
        revision={current.revision}
        tick={tick}
        onChanged={refresh}
      >
        <ProjectSourceContext.Provider value={projectContext}>
          <div className="git-page git-page-enter">
            <GitRemoteSync
              key={path}
              projectPath={path}
              tick={tick + current.revision}
              onChanged={refresh}
              onFetched={fetched}
              onShowChanges={() => setView('changes')}
              repository={
                <WorkspaceNavigation
                  project={project}
                  projects={projects}
                  tick={tick + remoteTick}
                  onProjectChange={setProjectId}
                  onRefresh={refresh}
                />
              }
            >
              <GitNavigationLayoutProvider>
                <div className="git-page-body" key={path} data-active-view={activeView}>
                  <Activity mode={activeView === 'changes' ? 'visible' : 'hidden'}>
                    <div className="git-view-pane">
                      <Suspense
                        fallback={
                          <GitWorkspaceLoading
                            navigation={navigation()}
                            navigationTabs={<WorkspaceViews />}
                          />
                        }
                      >
                        <ChangesPane
                          workspace
                          navigation={navigation}
                          navigationTabs={<WorkspaceViews />}
                          tick={tick}
                          requestNonce={source?.workspaceRequest.nonce ?? 0}
                          initialPath={
                            requestMatchesProject && source?.workspaceRequest.tab === 'changes'
                              ? (source.workspaceRequest.path ?? null)
                              : null
                          }
                          fallbackLabel=""
                        />
                      </Suspense>
                    </div>
                  </Activity>
                  <Activity mode={activeView === 'history' ? 'visible' : 'hidden'}>
                    <div className="git-view-pane">
                      <Suspense
                        fallback={
                          <GitWorkspaceLoading
                            view="history"
                            navigation={null}
                            navigationTabs={<WorkspaceViews />}
                          />
                        }
                      >
                        <GitHistoryWorkspace
                          key={historyPath ?? 'all'}
                          navigation={null}
                          navigationTabs={<WorkspaceViews />}
                          projectPath={path}
                          remoteTick={remoteTick}
                          tick={tick}
                          historyPath={historyPath}
                          onRepositoryChanged={refresh}
                        />
                      </Suspense>
                    </div>
                  </Activity>
                </div>
              </GitNavigationLayoutProvider>
            </GitRemoteSync>
          </div>
        </ProjectSourceContext.Provider>
      </GitRepositoryStatusProvider>
    </ViewContext.Provider>
  )
}
