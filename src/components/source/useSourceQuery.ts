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
  const request = useRef<{ scope: string; refresh: string; promise: Promise<T> } | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])
  useEffect(() => {
    if (!scope) {
      // Disabling a resource ends its request lifetime, allowing a fresh retry.
      // Activity hide/reveal keeps the scope and still reuses its request.
      request.current = null
      return
    }
    let live = true
    const requestScope = scope
    const requestRefresh = refreshKey
    // Activity reconnects effects on reveal. Reuse this hook's request/result
    // until its resource or revision changes, including an in-flight request.
    if (request.current?.scope !== scope || request.current.refresh !== refreshKey) {
      request.current = { scope, refresh: refreshKey, promise: loadRef.current() }
    }
    request.current.promise.then(
      (data) => {
        if (live)
          setState((current) =>
            current?.scope === requestScope &&
            current.refresh === requestRefresh &&
            current.data === data &&
            !current.error
              ? current
              : { scope: requestScope, refresh: requestRefresh, data },
          )
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
