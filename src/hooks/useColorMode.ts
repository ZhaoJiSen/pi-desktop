import { useSyncExternalStore } from 'react'
import { resolveColorMode, systemIsDark } from '../lib/appearance'
import type { Theme } from '../types'

function subscribe(callback: () => void) {
  if (typeof matchMedia === 'undefined') return () => {}
  const media = matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

export function useColorMode(theme: Theme) {
  const dark = useSyncExternalStore(subscribe, systemIsDark, () => false)
  return resolveColorMode(theme, dark)
}
