import { useEffect, useRef, useState } from 'react'

export interface SourceQuery<T> {
  loading: boolean
  data?: T
  error?: string
}

interface CachedQuery<T> {
  scope: string
  refresh: string
  data?: T
  error?: string
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

export function useSourceQuery<T>(
  scope: string | null,
  load: () => Promise<T>,
  refresh: string | number = '',
): SourceQuery<T> {
  const refreshKey = String(refresh)
  const [state, setState] = useState<CachedQuery<T> | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])
  useEffect(() => {
    if (!scope) return
    let live = true
    const requestScope = scope
    const requestRefresh = refreshKey
    loadRef.current().then(
      (data) => {
        if (live) setState({ scope: requestScope, refresh: requestRefresh, data })
      },
      (error: unknown) => {
        if (!live) return
        setState((current) => {
          if (current?.scope === requestScope && current.data !== undefined) {
            return { scope: requestScope, refresh: requestRefresh, data: current.data }
          }
          return { scope: requestScope, refresh: requestRefresh, error: messageOf(error) }
        })
      },
    )
    return () => {
      live = false
    }
  }, [scope, refreshKey])
  if (!scope) return { loading: false }
  if (!state || state.scope !== scope) return { loading: true }
  const pending = state.refresh !== refreshKey
  if (pending && state.data === undefined) return { loading: true, error: state.error }
  return { loading: false, data: state.data, error: pending ? undefined : state.error }
}
