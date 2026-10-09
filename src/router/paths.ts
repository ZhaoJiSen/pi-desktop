export const pagePaths = {
  chat: '/',
  commands: '/commands',
  extensions: '/extensions',
  usage: '/usage',
  settings: '/settings',
} as const

export type Page = keyof typeof pagePaths

export function pageFromPath(pathname: string): Page {
  switch (pathname.replace(/\/$/, '')) {
    case '/commands':
      return 'commands'
    case '/extensions':
      return 'extensions'
    case '/usage':
      return 'usage'
    case '/settings':
      return 'settings'
    default:
      return 'chat'
  }
}
