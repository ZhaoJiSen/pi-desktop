import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { GitPageSkeleton } from '../components/source/GitWorkspaceSkeleton'

export const gitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/git',
  pendingComponent: GitPageSkeleton,
  pendingMs: 0,
  pendingMinMs: 0,
  component: lazyRouteComponent(() => import('../pages/GitPage'), 'GitPage'),
})
