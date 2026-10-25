import { lazyRouteComponent } from '@tanstack/react-router'

export const ChatPage = lazyRouteComponent(() => import('../pages/ChatPage'), 'ChatPage')
export const SettingsPage = lazyRouteComponent(
  () => import('../pages/SettingsPage'),
  'SettingsPage',
)
export const GitPage = lazyRouteComponent(() => import('../pages/GitPage'), 'GitPage')
export const UsagePage = lazyRouteComponent(() => import('../pages/UsagePage'), 'UsagePage')
