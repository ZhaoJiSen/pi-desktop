import type { ExtensionPackage } from '../../types'
import type { DiscoverableCommand } from '../commands'
import { npmName } from '../packages'
import { commandOrigin } from '../draft'

// Match a verified installation identity or a complete package path segment, never a skill name.
export function resourcePackage(
  command: DiscoverableCommand | undefined,
  packages: ExtensionPackage[],
) {
  if (!command) return undefined
  const origin = commandOrigin(command).replaceAll('\\', '/')
  const matches = packages.filter((item) => {
    if (command.sourceInfo?.source === item.source) return true
    const name = npmName(item.source)
    if (name) return origin.includes(`/node_modules/${name}/`)
    const path = item.source
      .replace(/^file:/, '')
      .replaceAll('\\', '/')
      .replace(/\/$/, '')
    return path.startsWith('/') && (origin === path || origin.startsWith(`${path}/`))
  })
  // Duplicate global/project packages need scope provenance to avoid linking to the wrong installation.
  return matches.length === 1
    ? matches[0]
    : matches.find((item) => item.scope === command.sourceInfo?.scope)
}
