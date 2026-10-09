import { useRouterState } from '@tanstack/react-router'
import { pageFromPath } from './paths'

export function useCurrentPage() {
  return useRouterState({ select: (state) => pageFromPath(state.location.pathname) })
}
