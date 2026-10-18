import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connectSession,
  initializeDesktop,
  initializeLanguage,
  syncDesktopLanguage,
} from '../lib/desktop'
import { errorText } from '../lib/utils'
import { isDesktop, useWorkspace } from '../store/workspace'
import type { Page } from '../router/paths'
import { useColorMode } from './useColorMode'
import { accentKey, applyAppearance } from '../lib/appearance'

export function useDesktopLifecycle(view: Page, enabled = true) {
  const active = useWorkspace((state) => state.activeSessionId)
  const theme = useWorkspace((state) => state.theme)
  const palettesByMode = useWorkspace((state) => state.palettesByMode)
  const accentOverrides = useWorkspace((state) => state.accentOverrides)
  const mode = useColorMode(theme)
  const palette = palettesByMode[mode]
  const accent = accentOverrides[accentKey(mode, palette)]
  const language = useWorkspace((state) => state.language)
  const connection = useWorkspace((state) => state.connection)
  const [startup, setStartup] = useState<'loading' | 'error' | 'ready'>(
    isDesktop ? 'loading' : 'ready',
  )
  const [startupError, setStartupError] = useState<string | null>(null)
  const [deferred, setDeferred] = useState(false)
  const startupRequest = useRef({ generation: 0 })
  const allowConnection = !deferred || connection === 'connected'
  const beginStartup = useCallback(() => {
    if (!isDesktop || !enabled || deferred) return
    const request = startupRequest.current
    const generation = ++request.generation
    void initializeDesktop()
      .then(() => {
        if (generation === request.generation) setStartup('ready')
      })
      .catch((error) => {
        if (generation !== request.generation) return
        setStartupError(errorText(error))
        setStartup('error')
      })
  }, [enabled, deferred])
  useEffect(() => {
    const request = startupRequest.current
    beginStartup()
    return () => {
      request.generation++
    }
  }, [beginStartup])
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
    applyAppearance(document.documentElement, mode, palette, accent)
  }, [mode, palette, accent])
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
      startupRequest.current.generation++
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
