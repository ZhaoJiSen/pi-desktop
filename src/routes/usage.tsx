import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { UsagePage } from '../router/pageComponents'

export const usageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/usage',
  beforeLoad: () => (typeof window === 'undefined' ? undefined : UsagePage.preload?.()),
  component: () => null,
})
