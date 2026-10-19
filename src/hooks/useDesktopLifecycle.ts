import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
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
  useEffect(() => {
    const flush = () => {
      void useWorkspace.flushPersistence()
    }
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', hidden)
      flush()
    }
  }, [])
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
    // Newly exposed native pixels can paint before the web content during resize.
    // Match that backing surface on appearance changes, without resize listeners.
    if (isDesktop) {
      // Theme surface tokens are hex colors, as required by Tauri's Color API.
      const background = getComputedStyle(document.documentElement)
        .getPropertyValue('--ground')
        .trim()
      void getCurrentWebviewWindow()
        .setBackgroundColor(background)
        .catch((error) => console.warn('Unable to synchronize window background', error))
    }
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
