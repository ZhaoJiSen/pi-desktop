import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { ChatPage } from '../router/pageComponents'

export const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => (typeof window === 'undefined' ? undefined : ChatPage.preload?.()),
  // The persistent workspace owns this page so menu navigation preserves its DOM/state.
  component: () => null,
})
