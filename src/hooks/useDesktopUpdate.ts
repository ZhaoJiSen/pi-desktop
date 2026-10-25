import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useEffect, useRef, useState } from 'react'
import { isDesktop, useWorkspace } from '../store/workspace'
import { errorText } from '../lib/utils'
import { useT } from '../lib/i18n'

export interface DesktopUpdateStatus {
  revision: number
  phase: 'checking' | 'idle' | 'available' | 'downloading' | 'ready' | 'installing'
  version: string | null
  currentVersion: string | null
  notes: string | null
  downloaded: number
  total: number | null
  error: string | null
}

export function useDesktopUpdate() {
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const acting = useRef(false)
  const t = useT()
  useEffect(() => {
    if (!isDesktop) return
    let disposed = false
    let unlisten: UnlistenFn | undefined
    const receive = (next: DesktopUpdateStatus) => {
      if (!disposed)
        setStatus((current) => (!current || next.revision > current.revision ? next : current))
    }
    void (async () => {
      // Subscribe first, then read: the startup check may already have completed.
      const stop = await listen<DesktopUpdateStatus>('desktop-update', ({ payload }) =>
        receive(payload),
      )
      if (disposed) {
        stop()
        return
      }
      unlisten = stop
      receive(await invoke<DesktopUpdateStatus>('desktop_update_status'))
    })().catch((reason) => console.warn('Desktop update status unavailable', reason))
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  async function act() {
    if (acting.current || !status || !['available', 'ready'].includes(status.phase)) return
    acting.current = true
    setPending(true)
    setError('')
    try {
      if (status.phase === 'ready') {
        try {
          await useWorkspace.savePersistence()
        } catch {
          throw new Error(t('appUpdate.saveFailed'))
        }
      }
      await invoke(status.phase === 'ready' ? 'install_desktop_update' : 'download_desktop_update')
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      acting.current = false
      setPending(false)
    }
  }
  return { status, error: error || status?.error, pending, act }
}
