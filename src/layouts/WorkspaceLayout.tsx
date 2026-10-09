import { Outlet } from '@tanstack/react-router'
import { useKeyPress } from 'ahooks'
import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import {
  ExtensionDialog,
  ProjectDialog,
  RemoveSessionDialog,
  RenameDialog,
  SearchDialog,
} from '../components/Dialogs'
import { Header } from '../components/Header'
import { SplitPane } from '../components/SplitPane'
import { Sidebar } from '../components/Sidebar'
import { ActivityRail } from '../components/ActivityRail'
import { SidebarToggle, WindowControls } from '../components/Chrome'
import { ConnectionNotice } from '../components/ConnectionNotice'
import { RuntimeNotice } from '../components/RuntimeNotice'
import { StartupScreen } from '../components/StartupScreen'
import { onExtensionRequest, pickProject } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { errorText } from '../lib/utils'
import { isDesktop, useWorkspace } from '../store/workspace'
import type { ExtensionRequest } from '../types'
import { useDesktopLifecycle } from '../hooks/useDesktopLifecycle'
import { useCurrentPage } from '../router/hooks'
import { createChat, navigateToPage } from '../router/navigation'
import { WorkspaceActionsContext } from './WorkspaceActions'

export function WorkspaceLayout() {
  const sidebar = useWorkspace((state) => state.sidebarOpen)
  const active = useWorkspace((state) => state.activeSessionId)
  const connection = useWorkspace((state) => state.connection)
  const running = useWorkspace((state) => state.runningSessionId)
  const view = useCurrentPage()
  const showSidebar = sidebar && view === 'chat'
  const { startup, startupError, retryStartup, continueStartup } = useDesktopLifecycle(view)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [searchOpen, setSearchOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([])
  const t = useT()
  const closeExtension = useCallback(() => setExtensionRequests((items) => items.slice(1)), [])
  useEffect(
    () => onExtensionRequest((request) => setExtensionRequests((items) => [...items, request])),
    [],
  )
  async function addProject() {
    if (running || connection === 'connecting') return
    if (!isDesktop) {
      setProjectOpen(true)
      return
    }
    try {
      const projectId = await pickProject()
      if (projectId) void navigateToPage('chat')
    } catch (error) {
      useWorkspace.setState({ connectionError: errorText(error) })
    }
  }
  function newChat() {
    const store = useWorkspace.getState()
    if (store.runningSessionId || store.connection === 'connecting') return
    const current = store.sessions.find((session) => session.id === store.activeSessionId)
    const projectId = current?.projectId || store.projects.find((project) => !project.hidden)?.id
    if (projectId) createChat(projectId)
    else void addProject()
  }
  useKeyPress(['meta.n', 'ctrl.n'], (event) => {
    event.preventDefault()
    if (startup === 'ready') newChat()
  })
  useKeyPress(['meta.k', 'ctrl.k'], (event) => {
    event.preventDefault()
    if (startup === 'ready') setSearchOpen(true)
  })
  useKeyPress(['meta.b', 'ctrl.b'], (event) => {
    event.preventDefault()
    if (startup === 'ready') useWorkspace.getState().toggleSidebar()
  })
  if (startup !== 'ready')
    return (
      <MotionConfig reducedMotion="user">
        <main className={`app-shell startup-shell ${isDesktop ? 'native' : 'browser'}`}>
          <StartupScreen
            error={startupError}
            onRetry={retryStartup}
            onContinue={() => {
              void navigateToPage('settings')
              continueStartup()
            }}
          />
        </main>
        {extensionRequests[0] && (
          <ExtensionDialog
            key={extensionRequests[0].id}
            current={extensionRequests[0]}
            onClose={closeExtension}
          />
        )}
      </MotionConfig>
    )
  return (
    <MotionConfig reducedMotion="user">
      <main
        className={`app-shell ${showSidebar ? '' : 'sidebar-collapsed'} ${isDesktop ? 'native' : 'browser'}`}
        style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
      >
        <div className="window-chrome" data-tauri-drag-region="deep">
          <div className="window-controls" data-tauri-drag-region="deep">
            <WindowControls />
            {view === 'chat' && <SidebarToggle />}
          </div>
          {view === 'chat' && <Header onRename={() => setRenameId(active)} />}
        </div>
        <ActivityRail />
        <SplitPane
          className="workspace-surface"
          storageKey="pi.home-panel-width"
          defaultWidth={280}
          minWidth={200}
          minContentWidth={320}
          collapseAt={600}
          enabled={showSidebar}
          label={t('layout.resizeHome')}
          onWidthChange={setSidebarWidth}
        >
          {showSidebar && (
            <Sidebar
              onNew={newChat}
              onSearch={() => setSearchOpen(true)}
              onProject={() => void addProject()}
              onRename={setRenameId}
              onRemove={setRemoveId}
            />
          )}
          <section className="main" aria-label={t('sessions.current')}>
            {view !== 'chat' && view !== 'extensions' && (
              <Header onRename={() => setRenameId(active)} />
            )}
            {view !== 'chat' && <ConnectionNotice utility />}
            <WorkspaceActionsContext.Provider value={{ onProject: () => void addProject() }}>
              <Outlet />
            </WorkspaceActionsContext.Provider>
            <RuntimeNotice />
          </section>
        </SplitPane>
      </main>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ProjectDialog open={projectOpen} onClose={() => setProjectOpen(false)} />
      {renameId && (
        <RenameDialog key={renameId} sessionId={renameId} open onClose={() => setRenameId(null)} />
      )}
      {removeId && (
        <RemoveSessionDialog
          key={removeId}
          sessionId={removeId}
          onClose={() => setRemoveId(null)}
        />
      )}
      {extensionRequests[0] && (
        <ExtensionDialog
          key={extensionRequests[0].id}
          current={extensionRequests[0]}
          onClose={closeExtension}
        />
      )}
    </MotionConfig>
  )
}
