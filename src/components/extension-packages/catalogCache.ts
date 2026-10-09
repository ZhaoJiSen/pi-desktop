import type { browsePackages, CatalogPage, CatalogOptions } from '../../lib/packages'

const catalogCache = new WeakMap<
  typeof browsePackages,
  Map<string, { expires: number; result: Promise<CatalogPage> }>
>()
export function loadCatalog(
  service: typeof browsePackages,
  query: string,
  options: CatalogOptions,
  force: boolean,
) {
  let cache = catalogCache.get(service)
  if (!cache) catalogCache.set(service, (cache = new Map()))
  const key = JSON.stringify([query, options])
  const previous = cache.get(key)
  if (!force && previous && previous.expires > Date.now()) return previous.result
  const result = service(query, options).catch((error) => {
    if (cache.get(key)?.result === result) cache.delete(key)
    throw error
  })
  if (cache.size >= 20) cache.delete(cache.keys().next().value!)
  cache.set(key, { expires: Date.now() + 300_000, result })
  return result
}
