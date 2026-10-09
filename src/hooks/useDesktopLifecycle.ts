import { useCallback, useEffect, useState } from 'react'
import { connectSession, initializeDesktop, syncDesktopLanguage } from '../lib/desktop'
import { errorText } from '../lib/utils'
import { isDesktop, useWorkspace } from '../store/workspace'
import type { Page } from '../router/paths'

export function useDesktopLifecycle(view: Page) {
  const active = useWorkspace((state) => state.activeSessionId)
  const theme = useWorkspace((state) => state.theme)
  const language = useWorkspace((state) => state.language)
  const [startup, setStartup] = useState<'loading' | 'error' | 'ready'>(
    isDesktop ? 'loading' : 'ready',
  )
  const [startupError, setStartupError] = useState<string | null>(null)
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
    if (startup === 'ready' && (view === 'chat' || view === 'commands') && active)
      void connectSession(active)
  }, [active, startup, view])
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
  return {
    startup,
    startupError,
    continueStartup: () => setStartup('ready'),
    retryStartup: () => {
      setStartup('loading')
      setStartupError(null)
      beginStartup()
    },
  }
}
