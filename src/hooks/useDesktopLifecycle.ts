import { useCallback, useEffect, useRef, useState } from 'react'
import { Effect, EffectState } from '@tauri-apps/api/window'
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
import { applyFonts, loadSystemFonts } from '../lib/fonts'

export function useDesktopLifecycle(view: Page, enabled = true) {
  useEffect(() => {
    if (!isDesktop) return
    const appWindow = getCurrentWebviewWindow()
    void appWindow.setBackgroundColor([0, 0, 0, 0]).catch(() => {})
    void appWindow
      .setEffects({
        effects: [Effect.UnderWindowBackground],
        state: EffectState.Active,
        radius: 12,
      })
      .catch(() => {})
  }, [])
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
  const fonts = useWorkspace((state) => state.fonts)
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
    applyFonts(document.documentElement, fonts)
  }, [fonts])
  useEffect(() => {
    let alive = true
    void loadSystemFonts().then(() => {
      if (alive) applyFonts(document.documentElement, useWorkspace.getState().fonts)
    })
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    // Theme tokens stay in CSS. The native backing color is transparent so the
    // window material stays visible; painting --ground here would cover it.
    applyAppearance(document.documentElement, mode, palette, accent)
    // Vibrancy follows the window appearance. Match the resolved light or dark
    // mode, otherwise a light UI sits on the system's dark material.
    if (isDesktop)
      void getCurrentWebviewWindow()
        .setTheme(mode)
        .catch(() => {})
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
