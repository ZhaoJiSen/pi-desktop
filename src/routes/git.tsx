import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { rootRoute } from './__root'

export const gitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/git',
  component: lazyRouteComponent(() => import('../pages/GitPage'), 'GitPage'),
})
