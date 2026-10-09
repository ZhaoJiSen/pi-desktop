import type { ExtensionPackage } from '../types'
import { errorText } from './utils'
import { hasUpdate, npmName, type PackageInfo } from './packages'

export const packageKey = (item: ExtensionPackage) => `${item.scope}:${item.source}`
export const metadataSource = (path: string | undefined, packages: ExtensionPackage[]) =>
  JSON.stringify([path, packages.map(({ source, scope, version }) => [source, scope, version])])

export interface UpdateCheck {
  items: Record<string, PackageInfo>
  errors: Record<string, string>
}

export function summarizePackageCheck(packages: ExtensionPackage[], result: UpdateCheck) {
  let compared = 0
  let unknown = 0
  for (const pkg of packages) {
    const name = npmName(pkg.source)
    if (!name || !pkg.version || pkg.source !== `npm:${name}`) unknown++
    else if (result.items[name]) compared++
    else if (!result.errors[name]) unknown++
  }
  const failed = Object.keys(result.errors).length
  const status = !packages.length
    ? 'empty'
    : compared
      ? failed || unknown
        ? 'partial'
        : 'current'
      : failed
        ? 'failed'
        : 'unavailable'
  return { compared, unknown, failed, status }
}

// Reuse in-flight requests and successful results across view mounts for five minutes.
const checks = new WeakMap<
  (name: string) => Promise<PackageInfo>,
  Map<string, { expires: number; request: Promise<UpdateCheck> }>
>()
export function checkPackageUpdates(
  path: string,
  packages: ExtensionPackage[],
  lookup: (name: string) => Promise<PackageInfo>,
  force = false,
): Promise<UpdateCheck> {
  let cache = checks.get(lookup)
  if (!cache) checks.set(lookup, (cache = new Map()))
  const key = metadataSource(path, packages)
  const previous = cache.get(key)
  if (previous && (!force || previous.expires === Infinity) && previous.expires > Date.now())
    return previous.request
  const names = [...new Set(packages.flatMap((pkg) => npmName(pkg.source) || []))]
  const request = (async () => {
    const result: UpdateCheck = { items: {}, errors: {} }
    let next = 0
    await Promise.all(
      Array.from({ length: Math.min(3, names.length) }, async () => {
        while (next < names.length) {
          const name = names[next++]
          try {
            result.items[name] = await lookup(name)
          } catch (error) {
            result.errors[name] = errorText(error)
          }
        }
      }),
    )
    return result
  })()
  if (cache.size >= 20) cache.delete(cache.keys().next().value!)
  cache.set(key, { request, expires: Infinity })
  void request.then((result) => {
    const entry = cache.get(key)
    if (entry?.request === request) {
      entry.expires = Date.now() + (Object.keys(result.errors).length ? 30_000 : 300_000)
    }
  })
  return request
}

export function updatablePackages(packages: ExtensionPackage[], info: Record<string, PackageInfo>) {
  return packages.filter((pkg) => {
    const name = npmName(pkg.source)
    return name && pkg.source === `npm:${name}` && hasUpdate(pkg.version, info[name])
  })
}

export type PackageUpdateState = {
  status: 'queued' | 'updating' | 'done' | 'failed'
  error?: string
}

export function clearCompletedPackageUpdates(states: Record<string, PackageUpdateState>) {
  return Object.fromEntries(Object.entries(states).filter(([, state]) => state.status !== 'done'))
}

export async function updatePackageBatch(
  packages: ExtensionPackage[],
  update: (item: ExtensionPackage) => Promise<void>,
  onState: (item: ExtensionPackage, state: PackageUpdateState) => void,
) {
  let succeeded = 0
  let failed = 0
  // Native pi package operations are serialized. Continue after an individual failure.
  for (const item of packages) {
    onState(item, { status: 'updating' })
    try {
      await update(item)
      succeeded++
      onState(item, { status: 'done' })
    } catch (error) {
      failed++
      onState(item, { status: 'failed', error: errorText(error) })
    }
  }
  return { succeeded, failed }
}
