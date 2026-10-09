import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { rootRoute } from './__root'

export const usageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/usage',
  component: lazyRouteComponent(() => import('../pages/UsagePage'), 'UsagePage'),
})
