import { Button, ListBox } from '@heroui/react'
import { Package } from 'lucide-react'
import { hasUpdate, npmName, packageName, type PackageInfo } from '../../../lib/packages'
import { packageKey as keyOf } from '../../../lib/packageUpdates'
import type { ExtensionPackage } from '../../../types'
import { useT } from '../../../lib/i18n'
import { PackageOption } from '../PackageOption'
import { PackageScrollArea } from '../PackageScrollArea'
import { PackageListSkeleton } from '../PackageListSkeleton'
import type { PackageLibraryProps } from './types'

export function PackageLibraryList({
  packages,
  mode,
  search,
  sort,
  loading,
  error,
  items,
  item,
  catalog,
  info,
  updateInfo,
  checkErrors,
  batchStates,
  query,
  clearQuery,
  selectPackage,
}: Pick<
  PackageLibraryProps,
  | 'packages'
  | 'mode'
  | 'search'
  | 'sort'
  | 'loading'
  | 'error'
  | 'items'
  | 'item'
  | 'catalog'
  | 'info'
  | 'updateInfo'
  | 'checkErrors'
  | 'batchStates'
  | 'query'
  | 'clearQuery'
  | 'selectPackage'
>) {
  const t = useT()
  function packageSubtitle(pkg: ExtensionPackage, metadata: PackageInfo | undefined) {
    const state = batchStates[keyOf(pkg)]
    if (mode === 'installed') {
      const identity = `${t(`extensions.scope.${pkg.scope}`)}${pkg.version ? ` · v${pkg.version}` : ''}`
      if (state) return `${identity} · ${t(`packages.${state.status}`)}`
      const pkgName = npmName(pkg.source)
      if (pkgName && checkErrors[pkgName]) return `${identity} · ${t('packages.detectionFailed')}`
      if (metadata && pkg.source === `npm:${pkgName}` && hasUpdate(pkg.version, metadata))
        return `${identity} → v${metadata.version}`
      return identity
    }
    const author = metadata?.author || 'npm'
    if (sort === 'downloads' && metadata?.downloads != null)
      return `${author} · ${t('packages.downloads', { count: new Intl.NumberFormat(undefined, { notation: 'compact' }).format(metadata.downloads) })}`
    if (metadata?.publishedAt)
      return `${t('packages.published', { date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(metadata.publishedAt) })}`
    return author
  }

  return (
    <PackageScrollArea
      className="package-scroll"
      label={t(mode === 'installed' ? 'packages.installed' : 'packages.discover')}
    >
      {loading ? (
        <PackageListSkeleton />
      ) : items.length ? (
        <ListBox
          className="package-list"
          aria-label={t(mode === 'installed' ? 'packages.installed' : 'packages.discover')}
          selectionMode="single"
          selectionBehavior="replace"
          disallowEmptySelection
          selectedKeys={item ? [keyOf(item)] : []}
          onSelectionChange={(keys) => {
            if (keys === 'all') return
            const selected = items.find((pkg) => keys.has(keyOf(pkg)))
            if (selected) selectPackage(selected)
          }}
          items={items}
          dependencies={[
            mode,
            packages,
            updateInfo,
            info,
            catalog,
            checkErrors,
            batchStates,
            sort,
            t,
          ]}
        >
          {(pkg) => {
            const pkgName = npmName(pkg.source)
            const installed =
              mode === 'installed'
                ? pkg
                : packages.find((installed) => npmName(installed.source) === pkgName)
            const metadata = pkgName
              ? updateInfo[pkgName] ||
                info[pkgName] ||
                catalog.find((item) => item.name === pkgName)
              : undefined
            const available =
              pkgName && pkg.source === `npm:${pkgName}` && hasUpdate(pkg.version, metadata)
            return (
              <ListBox.Item
                id={keyOf(pkg)}
                textValue={packageName(pkg.source)}
                className="package-option sidebar-option"
              >
                <PackageOption
                  name={packageName(pkg.source)}
                  installedLabel={
                    mode === 'discover' && installed && installed.enabled !== false
                      ? t('packages.installed')
                      : undefined
                  }
                  disabledLabel={installed?.enabled === false ? t('packages.disabled') : undefined}
                  subtitle={packageSubtitle(pkg, metadata)}
                  updateState={batchStates[keyOf(pkg)]}
                  updateLabel={available ? t('packages.updateAvailable') : undefined}
                />
              </ListBox.Item>
            )
          }}
        </ListBox>
      ) : (
        <div className="package-empty">
          <Package />
          <p>
            {search
              ? t('packages.noResults')
              : mode === 'discover'
                ? t(error ? 'packages.catalogUnavailable' : 'packages.noCatalog')
                : t('packages.noPackages')}
          </p>
          {query && (
            <Button variant="ghost" onPress={clearQuery}>
              {t('packages.clearSearch')}
            </Button>
          )}
        </div>
      )}
    </PackageScrollArea>
  )
}
