import { Button } from '@heroui/react'
import { useKeyPress } from 'ahooks'
import { MotionConfig } from 'motion/react'
import { LoaderCircle, RotateCw, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Composer } from './components/Composer'
import { Conversation } from './components/Conversation'
import {
  ExtensionDialog,
  ProjectDialog,
  RemoveSessionDialog,
  RenameDialog,
  SearchDialog,
} from './components/Dialogs'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { RuntimeNotice } from './components/RuntimeNotice'
import { StartupScreen } from './components/StartupScreen'
import { ExtensionsView, SettingsView, UsageView } from './components/UtilityViews'
import {
  connectSession,
  initializeDesktop,
  onExtensionRequest,
  pickProject,
  syncDesktopLanguage,
} from './lib/desktop'
import { useT } from './lib/i18n'
import { errorText } from './lib/utils'
import { isDesktop, useWorkspace } from './store/workspace'
import type { ExtensionRequest } from './types'

export default function App() {
  const sidebar = useWorkspace((state) => state.sidebarOpen)
  const active = useWorkspace((state) => state.activeSessionId)
  const theme = useWorkspace((state) => state.theme)
  const language = useWorkspace((state) => state.language)
  const view = useWorkspace((state) => state.view)
  const error = useWorkspace((state) => state.connectionError)
  const storageError = useWorkspace((state) => state.storageError)
  const connection = useWorkspace((state) => state.connection)
  const connectionAction = useWorkspace((state) => state.connectionAction)
  const running = useWorkspace((state) => state.runningSessionId)
  const [searchOpen, setSearchOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([])
  const [startup, setStartup] = useState<'loading' | 'error' | 'ready'>(
    isDesktop ? 'loading' : 'ready',
  )
  const [startupError, setStartupError] = useState<string | null>(null)
  const t = useT()
  const closeExtension = useCallback(() => setExtensionRequests((items) => items.slice(1)), [])
  async function addProject() {
    if (running || connection === 'connecting') return
    if (!isDesktop) {
      setProjectOpen(true)
      return
    }
    try {
      await pickProject()
    } catch (error) {
      useWorkspace.setState({ connectionError: errorText(error) })
    }
  }
  function newChat() {
    const store = useWorkspace.getState()
    if (store.runningSessionId || store.connection === 'connecting') return
    const current = store.sessions.find((session) => session.id === store.activeSessionId)
    const projectId = current?.projectId || store.projects.find((project) => !project.hidden)?.id
    if (projectId) store.createSession(projectId)
    else void addProject()
  }
  const beginStartup = useCallback(() => {
    if (!isDesktop) return
    void initializeDesktop()
      .then(() => setStartup('ready'))
      .catch((error) => {
        setStartupError(errorText(error))
        setStartup('error')
      })
  }, [])
  useEffect(beginStartup, [beginStartup])
  useEffect(() => {
    if (startup === 'ready' && view === 'chat' && active) void connectSession(active)
  }, [active, startup, view])
  useEffect(
    () => onExtensionRequest((request) => setExtensionRequests((items) => [...items, request])),
    [],
  )
  useEffect(() => {
    const preference = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (preference.matches ? 'dark' : 'light') : theme
    }
    apply()
    preference.addEventListener('change', apply)
    return () => preference.removeEventListener('change', apply)
  }, [theme])
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    document.title = 'pi Desktop'
  }, [language])
  useEffect(() => {
    // Startup synchronizes before opening any pi process; later preference changes
    // update the same native locale without reconnecting existing processes.
    if (startup === 'ready')
      void syncDesktopLanguage().catch((error) =>
        useWorkspace.setState({ connectionError: errorText(error) }),
      )
  }, [language, startup])
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
            onRetry={() => {
              setStartup('loading')
              setStartupError(null)
              beginStartup()
            }}
            onContinue={() => {
              useWorkspace.getState().setView('settings')
              setStartup('ready')
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
        className={`app-shell ${sidebar ? '' : 'sidebar-collapsed'} ${isDesktop ? 'native' : 'browser'}`}
      >
        {sidebar && (
          <Sidebar
            onNew={newChat}
            onSearch={() => setSearchOpen(true)}
            onProject={() => void addProject()}
            onRename={setRenameId}
            onRemove={setRemoveId}
          />
        )}
        <section className="main" aria-label={t('sessions.current')}>
          <Header onRename={() => setRenameId(active)} />
          {view !== 'chat' && (error || storageError) && (
            <div className="connection-notice utility-notice" role="alert">
              <TriangleAlert />
              <span>{storageError || error}</span>
              {isDesktop && active && !running && (
                <Button
                  variant="ghost"
                  className="notice-action"
                  isDisabled={connection === 'connecting'}
                  onPress={() => void connectSession(active, true)}
                >
                  <RotateCw />
                  {t('connection.reconnect')}
                </Button>
              )}
            </div>
          )}
          {view === 'chat' ? (
            <>
              <Conversation onProject={() => void addProject()} />
              <div className="composer-area">
                {(error || storageError) && (
                  <div className="connection-notice" role="alert">
                    <TriangleAlert />
                    <span>{storageError || error}</span>
                    {isDesktop && active && !running && (
                      <Button
                        variant="ghost"
                        className="notice-action"
                        isDisabled={connection === 'connecting'}
                        onPress={() => void connectSession(active, true)}
                      >
                        <RotateCw />
                        {t('connection.reconnect')}
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      variant="ghost"
                      className="icon-button"
                      aria-label={t('common.close')}
                      onPress={() => useWorkspace.setState({ connectionError: null })}
                    >
                      <X />
                    </Button>
                  </div>
                )}
                {connection === 'connecting' && connectionAction === 'start' && (
                  <div className="connecting-notice" role="status">
                    <LoaderCircle className="spinner" />
                    {t('connection.connecting')}
                  </div>
                )}
                <Composer key={active} />
              </div>
            </>
          ) : view === 'usage' ? (
            <UsageView />
          ) : view === 'extensions' ? (
            <ExtensionsView />
          ) : (
            <SettingsView />
          )}
          <RuntimeNotice />
        </section>
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
