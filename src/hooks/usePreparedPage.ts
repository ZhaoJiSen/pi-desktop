import { startTransition, useLayoutEffect, useRef, useState } from 'react'
import type { Page } from '../router/paths'

// Cold pages get a painted shell; warm pages must not flash a skeleton on every visit.
export function usePreparedPage(page: Page) {
  const [state, setState] = useState(() => ({ prepared: page, visited: [page] }))
  const warm = state.visited.includes(page)
  if (warm && state.prepared !== page) setState({ ...state, prepared: page })
  const prepared = warm ? page : state.prepared
  const generation = useRef(0)
  useLayoutEffect(() => {
    const guard = generation
    const current = ++guard.current
    if (prepared === page) return
    let second: number | undefined
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        startTransition(() => {
          setState((previous) =>
            guard.current === current
              ? { prepared: page, visited: [...previous.visited, page] }
              : previous,
          )
        })
      })
    })
    return () => {
      guard.current++
      cancelAnimationFrame(first)
      if (second !== undefined) cancelAnimationFrame(second)
    }
  }, [page, prepared])
  return prepared
}
