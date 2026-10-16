import { Outlet } from '@tanstack/react-router'
import { useKeyPress } from 'ahooks'
import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { ExtensionDialog } from '../components/dialogs/ExtensionDialog'
import { ProjectDialog } from '../components/dialogs/ProjectDialog'
import { RemoveSessionDialog } from '../components/dialogs/RemoveSessionDialog'
import { RenameDialog } from '../components/dialogs/RenameDialog'
import { SearchDialog } from '../components/dialogs/SearchDialog'
import { Header } from '../components/Header'
import { SidebarLayout, SidebarWidthProvider } from './SidebarLayout'
import { Sidebar } from '../components/Sidebar'
import { ActivityRail } from '../components/ActivityRail'
import { SidebarToggle, WindowControls } from '../components/Chrome'
import { ConnectionNotice } from '../components/ConnectionNotice'
import { RuntimeNotice } from '../components/RuntimeNotice'
import { StartupScreen } from '../components/StartupScreen'
import { onExtensionRequest, pickProject } from '../lib/desktop'
import { openRecentProject } from '../lib/recent'
import { folderForNewChat } from '../lib/recentProject'
import { useT } from '../lib/i18n'
import { reportActionNotice } from '../lib/notices'
import { isDesktop, useWorkspace } from '../store/workspace'
import type { ExtensionRequest } from '../types'
import { useDesktopLifecycle } from '../hooks/useDesktopLifecycle'
import { useCurrentPage } from '../router/hooks'
import { createChat, navigateToPage } from '../router/navigation'
import { WorkspaceActionsContext } from './WorkspaceActions'
import { OnboardingPage } from '../pages/OnboardingPage'
import { PiUpdateDialog } from '../components/PiUpdateDialog'
import { usePiUpdatePrompt } from '../hooks/usePiUpdatePrompt'

export function WorkspaceLayout() {
  const sidebar = useWorkspace((state) => state.sidebarOpen)
  const active = useWorkspace((state) => state.activeSessionId)
  const connection = useWorkspace((state) => state.connection)
  const running = useWorkspace((state) => state.runningSessionId)
  const onboardingOpen = useWorkspace((state) => state.onboardingOpen)
  const updating = useWorkspace((state) => state.piUpdating)
  const view = useCurrentPage()
  const showSidebar = sidebar && view === 'chat'
  const { startup, startupError, retryStartup, continueStartup, finishOnboarding } =
    useDesktopLifecycle(view, !onboardingOpen)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [searchOpen, setSearchOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([])
  const piUpdate = usePiUpdatePrompt(
    startup === 'ready',
    onboardingOpen,
    searchOpen || projectOpen || Boolean(renameId || removeId || extensionRequests.length),
  )
  const t = useT()
  const closeExtension = useCallback(() => setExtensionRequests((items) => items.slice(1)), [])
  useEffect(
    () => onExtensionRequest((request) => setExtensionRequests((items) => [...items, request])),
    [],
  )
  async function addProject() {
    if (updating || running || connection === 'connecting') return
    if (!isDesktop) {
      setProjectOpen(true)
      return
    }
    try {
      const projectId = await pickProject()
      if (projectId) void navigateToPage('chat')
    } catch (error) {
      reportActionNotice(error)
    }
  }
  async function newChat() {
    const store = useWorkspace.getState()
    if (store.piUpdating || store.runningSessionId || store.connection === 'connecting') return
    const folderId = folderForNewChat(store)
    if (folderId) {
      createChat(folderId)
      return
    }
    try {
      createChat(await openRecentProject())
    } catch (error) {
      reportActionNotice(error)
    }
  }
  useKeyPress(['meta.n', 'ctrl.n'], (event) => {
    event.preventDefault()
    if (!onboardingOpen && startup === 'ready' && !updating && !piUpdate.update) newChat()
  })
  useKeyPress(['meta.k', 'ctrl.k'], (event) => {
    event.preventDefault()
    if (!onboardingOpen && startup === 'ready' && !updating && !piUpdate.update) setSearchOpen(true)
  })
  useKeyPress(['meta.b', 'ctrl.b'], (event) => {
    event.preventDefault()
    if (!onboardingOpen && startup === 'ready' && !updating && !piUpdate.update)
      useWorkspace.getState().toggleSidebar()
  })
  const extensionDialog = extensionRequests[0] && (
    <ExtensionDialog
      key={extensionRequests[0].id}
      current={extensionRequests[0]}
      onClose={closeExtension}
    />
  )
  if (onboardingOpen)
    return (
      <MotionConfig reducedMotion="user">
        <main className={`app-shell startup-shell ${isDesktop ? 'native' : 'browser'}`}>
          <OnboardingPage
            onEnter={(connect) => {
              finishOnboarding(connect)
              void navigateToPage('chat')
            }}
          />
        </main>
        {extensionDialog}
      </MotionConfig>
    )
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
        {extensionDialog}
      </MotionConfig>
    )
  return (
    <MotionConfig reducedMotion="user">
      <SidebarWidthProvider>
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
          <SidebarLayout
            className="workspace-surface"
            collapseAt={600}
            label={t('layout.resizeHome')}
            onWidthChange={setSidebarWidth}
            sidebar={
              showSidebar && (
                <Sidebar
                  onNew={newChat}
                  onSearch={() => setSearchOpen(true)}
                  onProject={() => void addProject()}
                  onRename={setRenameId}
                  onRemove={setRemoveId}
                />
              )
            }
          >
            <section className="main" aria-label={t('sessions.current')}>
              {view !== 'chat' &&
                view !== 'extensions' &&
                view !== 'commands' &&
                view !== 'usage' && <Header onRename={() => setRenameId(active)} />}
              {view !== 'chat' && <ConnectionNotice utility />}
              <WorkspaceActionsContext.Provider value={{ onProject: () => void addProject() }}>
                <Outlet />
              </WorkspaceActionsContext.Provider>
              <RuntimeNotice />
            </section>
          </SidebarLayout>
        </main>
      </SidebarWidthProvider>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      {piUpdate.update && <PiUpdateDialog update={piUpdate.update} onClose={piUpdate.dismiss} />}
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
      {extensionDialog}
    </MotionConfig>
  )
}
