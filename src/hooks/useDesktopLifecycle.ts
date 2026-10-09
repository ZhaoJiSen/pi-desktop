import { useCallback, useEffect, useState } from 'react'
import {
  connectSession,
  initializeDesktop,
  initializeLanguage,
  syncDesktopLanguage,
} from '../lib/desktop'
import { errorText } from '../lib/utils'
import { isDesktop, useWorkspace } from '../store/workspace'
import type { Page } from '../router/paths'

export function useDesktopLifecycle(view: Page, enabled = true) {
  const active = useWorkspace((state) => state.activeSessionId)
  const theme = useWorkspace((state) => state.theme)
  const language = useWorkspace((state) => state.language)
  const connection = useWorkspace((state) => state.connection)
  const [startup, setStartup] = useState<'loading' | 'error' | 'ready'>(
    isDesktop ? 'loading' : 'ready',
  )
  const [startupError, setStartupError] = useState<string | null>(null)
  const [deferred, setDeferred] = useState(false)
  const allowConnection = !deferred || connection === 'connected'
  const beginStartup = useCallback(() => {
    if (!isDesktop || !enabled || deferred) return
    void initializeDesktop()
      .then(() => setStartup('ready'))
      .catch((error) => {
        setStartupError(errorText(error))
        setStartup('error')
      })
  }, [enabled, deferred])
  useEffect(beginStartup, [beginStartup])
  useEffect(() => {
    if (!enabled) void initializeLanguage().catch(() => {})
  }, [enabled])
  useEffect(() => {
    if (
      enabled &&
      allowConnection &&
      startup === 'ready' &&
      (view === 'chat' || view === 'commands') &&
      active
    )
      void connectSession(active)
  }, [active, startup, view, enabled, allowConnection])
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
    if (startup === 'ready' || !enabled)
      void syncDesktopLanguage().catch((error) =>
        useWorkspace.setState({ connectionError: errorText(error) }),
      )
  }, [language, startup, enabled])
  return {
    startup,
    startupError,
    finishOnboarding: (connect: boolean) => {
      setDeferred(!connect)
      setStartup(connect && isDesktop ? 'loading' : 'ready')
      setStartupError(null)
    },
    continueStartup: () => setStartup('ready'),
    retryStartup: () => {
      setStartup('loading')
      setStartupError(null)
      beginStartup()
    },
  }
}
