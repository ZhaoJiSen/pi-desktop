import {
  createHashHistory,
  createMemoryHistory,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router'
import { rootRoute } from '../routes/__root'
import { chatRoute } from '../routes'
import { commandsRoute } from '../routes/commands'
import { extensionsRoute } from '../routes/extensions'
import { usageRoute } from '../routes/usage'
import { settingsRoute } from '../routes/settings'

const routeTree = rootRoute.addChildren([
  chatRoute,
  commandsRoute,
  extensionsRoute,
  usageRoute,
  settingsRoute,
])

export function createAppRouter(history: RouterHistory) {
  return createRouter({ routeTree, history, defaultPreload: 'intent' })
}

// Hash paths also work when the desktop webview serves bundled static assets.
export const router = createAppRouter(
  typeof window === 'undefined' ? createMemoryHistory() : createHashHistory(),
)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
