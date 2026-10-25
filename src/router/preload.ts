import { router } from './index'
import { ChatPage, GitPage, SettingsPage, UsagePage } from './pageComponents'
import { pagePaths, type Page } from './paths'

const retainedPages: Partial<Record<Page, typeof ChatPage>> = {
  chat: ChatPage,
  settings: SettingsPage,
  git: GitPage,
  usage: UsagePage,
}

export function preloadPage(page: Page) {
  const load = retainedPages[page]
  // Failed speculative loads must never interrupt navigation or raise an unhandled rejection.
  void Promise.resolve(
    load ? load.preload?.() : router.preloadRoute({ to: pagePaths[page] }),
  ).catch(() => {})
}
