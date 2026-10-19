import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isDesktop } from '../store/workspace'

export function useAppForeground() {
  const [focused, setFocused] = useState(() => document.hasFocus())
  useEffect(() => {
    let revision = 0
    const focus = () => {
      revision++
      setFocused(document.visibilityState !== 'hidden')
    }
    const blur = () => {
      revision++
      setFocused(false)
    }
    const visibility = () => {
      revision++
      setFocused(document.visibilityState !== 'hidden' && document.hasFocus())
    }
    window.addEventListener('focus', focus)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', visibility)
    let disposed = false
    let unlisten: (() => void) | undefined
    if (isDesktop) {
      try {
        const window = getCurrentWindow()
        const initialRevision = revision
        void window
          .onFocusChanged(({ payload }) => {
            revision++
            if (!disposed) setFocused(payload && document.visibilityState !== 'hidden')
          })
          .then((stop) => {
            if (disposed) stop()
            else unlisten = stop
          })
          .catch(() => {})
        void window
          .isFocused()
          .then((value) => {
            if (!disposed && revision === initialRevision)
              setFocused(value && document.visibilityState !== 'hidden')
          })
          .catch(() => {})
      } catch {
        /* Browser previews have no native window; DOM focus remains authoritative. */
      }
    }
    return () => {
      disposed = true
      unlisten?.()
      window.removeEventListener('focus', focus)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  return focused
}
