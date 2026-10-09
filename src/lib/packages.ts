import { invoke, isTauri } from '@tauri-apps/api/core'
import type { ExtensionPackage } from '../types'
import { useWorkspace } from '../store/workspace'
import { t } from './i18n'

export interface PackageInfo {
  name: string
  version: string
  description: string
  author: string
  license: string
  resources: string[]
  newerThan: string[]
  downloads?: number
  publishedAt?: number
}

export interface CatalogOptions {
  sort: 'downloads' | 'recent'
  category: '' | 'extension' | 'skill' | 'prompt' | 'theme'
  page: number
}

export interface CatalogPage {
  items: PackageInfo[]
  hasNext: boolean
}

export function npmName(source: string): string | null {
  if (!source.startsWith('npm:')) return null
  return (
    /^(@[a-z0-9_][a-z0-9_.-]*\/[a-z0-9_][a-z0-9_.-]*|[a-z0-9_][a-z0-9_.-]*)(?:@[^\s]+)?$/i.exec(
      source.slice(4),
    )?.[1] || null
  )
}

export function packageName(source: string) {
  return (
    npmName(source) || source.replace(/^git:/, '').replace(/\/$/, '').split('/').at(-1) || source
  )
}

export function hasUpdate(installed: string | undefined, info: PackageInfo | undefined) {
  return Boolean(installed && info?.newerThan.includes(installed))
}

// Cancelling a view drops the response. Native requests have their own timeout.
async function packageRequest<T>(
  command: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted()
  if (!isTauri()) throw new Error(t('packages.desktopOnly'))
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    signal?.addEventListener('abort', aborted, { once: true })
    invoke<T>(command, args)
      .then(resolve, reject)
      .finally(() => {
        signal?.removeEventListener('abort', aborted)
      })
  })
}

export async function packageInfo(name: string, signal?: AbortSignal): Promise<PackageInfo> {
  const installedVersions = useWorkspace
    .getState()
    .packages.filter((item) => npmName(item.source) === name)
    .flatMap((item) => (item.version ? [item.version] : []))
  return packageRequest('package_info', { name, installedVersions }, signal)
}

export async function discoverPackages(
  query: string,
  signal?: AbortSignal,
): Promise<PackageInfo[]> {
  return packageRequest('discover_packages', { query }, signal)
}

export async function browsePackages(
  query: string,
  options: CatalogOptions,
  signal?: AbortSignal,
): Promise<CatalogPage> {
  return packageRequest('browse_extension_catalog', { query, ...options }, signal)
}

export async function packageMetadata(packages: ExtensionPackage[]): Promise<PackageInfo[]> {
  return packageRequest('extension_package_metadata', { packages })
}

export async function managePackage(
  action: 'install' | 'update' | 'remove' | 'enable' | 'disable',
  item: ExtensionPackage,
  path: string,
) {
  if (!isTauri()) throw new Error(t('packages.desktopOnly'))
  await invoke('manage_extension_package', {
    action,
    source: item.source,
    scope: item.scope,
    path,
    executable: useWorkspace.getState().piExecutable,
  })
}

export async function openPackagePage(name?: string) {
  const url = name
    ? `https://pi.dev/packages/${encodeURIComponent(name)}`
    : 'https://pi.dev/packages'
  if (isTauri()) await invoke('open_extension_page', { url })
  else window.open(url, '_blank', 'noopener,noreferrer')
}
