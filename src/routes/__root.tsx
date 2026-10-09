import { createRootRoute, lazyRouteComponent, Navigate } from '@tanstack/react-router'

export const rootRoute = createRootRoute({
  component: lazyRouteComponent(() => import('../layouts/WorkspaceLayout'), 'WorkspaceLayout'),
  notFoundComponent: () => <Navigate to="/" replace />,
})
