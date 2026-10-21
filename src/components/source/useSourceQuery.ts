import { useEffect, useRef, useState } from 'react'

export interface SourceQuery<T> {
  loading: boolean
  data?: T
  error?: string
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

export function useSourceQuery<T>(key: string | null, load: () => Promise<T>): SourceQuery<T> {
  const [state, setState] = useState<{ key: string; data?: T; error?: string } | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])
  useEffect(() => {
    if (!key) return
    let live = true
    loadRef.current().then(
      (data) => {
        if (live) setState({ key, data })
      },
      (error: unknown) => {
        if (live) setState({ key, error: messageOf(error) })
      },
    )
    return () => {
      live = false
    }
  }, [key])
  if (!key) return { loading: false }
  if (!state || state.key !== key) return { loading: true }
  return { loading: false, data: state.data, error: state.error }
}
