import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { SettingsPage } from '../router/pageComponents'

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: () => (typeof window === 'undefined' ? undefined : SettingsPage.preload?.()),
  component: () => null,
})
