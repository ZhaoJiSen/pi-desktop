import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { rootRoute } from './__root'

export const commandsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/commands',
  component: lazyRouteComponent(() => import('../pages/CommandsPage'), 'CommandsPage'),
})
