export const pagePaths = {
  chat: '/',
  git: '/git',
  commands: '/commands',
  extensions: '/extensions',
  usage: '/usage',
  settings: '/settings',
} as const

export type Page = keyof typeof pagePaths

export function pageFromPath(pathname: string): Page {
  switch (pathname.replace(/\/$/, '')) {
    case '/git':
      return 'git'
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
