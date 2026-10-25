import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { GitPageSkeleton } from '../components/source/GitWorkspaceSkeleton'
import { GitPage } from '../router/pageComponents'

export const gitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/git',
  pendingComponent: GitPageSkeleton,
  pendingMs: 0,
  pendingMinMs: 0,
  beforeLoad: () => (typeof window === 'undefined' ? undefined : GitPage.preload?.()),
  component: () => null,
})
