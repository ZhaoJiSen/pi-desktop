import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { rootRoute } from './__root'

export const extensionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/extensions',
  component: lazyRouteComponent(() => import('../pages/ExtensionsPage'), 'ExtensionsPage'),
})
