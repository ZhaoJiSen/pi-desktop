import { useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Button,
  ListBox,
  Pagination,
  SearchField,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { hasUpdate, npmName, packageName, type PackageInfo } from '../../lib/packages'
import { packageKey as keyOf } from '../../lib/packageUpdates'
import type { ExtensionPackage } from '../../types'
import { PackageOption } from './PackageOption'
import { PackageUpdateSummary } from './PackageUpdateSummary'
import { PackageToolButton } from './PackageToolButton'
import { PackageLoadingIcon } from './PackageLoadingIcon'
import { PackageFeedback } from './PackageFeedback'
import { PackageScrollArea } from './PackageScrollArea'
import { PackageListSkeleton } from './PackageListSkeleton'

import { useT } from '../../lib/i18n'
import type { ExtensionPackagesController } from './useExtensionPackages'

type Props = ExtensionPackagesController['library'] &
  Pick<ExtensionPackagesController, 'packageCount' | 'changeMode' | 'feedback'>

export function PackageLibrary({
  packages,
  mode,
  packageCount,
  changeMode,
  query,
  search,
  sort,
  category,
  page,
  loading,
  error,
  items,
  item,
  catalog,
  info,
  updateInfo,
  checkErrors,
  batchStates,
  busy,
  path,
  hasNext,
  changeQuery,
  clearQuery,
  changeSort,
  changeCategory,
  selectPackage,
  changePage,
  openPage,
  updates,
  feedback,
}: Props) {
  const t = useT()
  const reduced = useReducedMotion()
  const [searchOpen, setSearchOpen] = useState(false)
  const searchLabel = t(
    mode === 'installed' ? 'packages.installedSearch' : 'packages.discoverSearch',
  )
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
    <section
      className="package-library"
      aria-label={mode === 'installed' ? t('packages.installed') : t('packages.discover')}
    >
      <div className="package-library-controls">
        <h2 className="package-library-title">{t('navigation.extensions')}</h2>
        <div className="package-library-toolbar">
          <Tabs
            selectedKey={mode}
            onSelectionChange={(key) => changeMode(key as typeof mode)}
            className="package-tabs"
          >
            <Tabs.List aria-label={t('extensions.packages')}>
              <Tabs.Tab id="installed">
                {t('packages.installed')}
                <span className="package-count">{packageCount}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="discover">
                {t('packages.discover')}
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <div className="package-library-tools">
            <PackageToolButton
              label={
                searchOpen
                  ? t('packages.closeSearch')
                  : t(
                      mode === 'installed'
                        ? 'packages.searchInstalledAction'
                        : 'packages.searchCatalogAction',
                    )
              }
              className="package-search-toggle"
              aria-expanded={searchOpen}
              aria-controls="package-library-search"
              onPress={() => {
                if (searchOpen) clearQuery()
                setSearchOpen(!searchOpen)
              }}
            >
              {searchOpen ? <X /> : <Search />}
            </PackageToolButton>
            {mode === 'installed' ? (
              <PackageToolButton
                label={t('packages.checkUpdates')}
                className="package-check"
                isPending={updates.checking}
                isDisabled={updates.checking || Boolean(busy) || !path}
                onPress={() => void updates.checkUpdates()}
              >
                {updates.checking ? <PackageLoadingIcon /> : <RefreshCw />}
              </PackageToolButton>
            ) : (
              <PackageToolButton label={t('packages.officialCatalog')} onPress={() => openPage()}>
                <ArrowUpRight />
              </PackageToolButton>
            )}
          </div>
        </div>
        <AnimatePresence initial={false}>
          {searchOpen && (
            <motion.div
              id="package-library-search"
              className="package-search-reveal"
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.16 }}
            >
              <SearchField
                className="package-search"
                value={query}
                onChange={changeQuery}
                aria-label={searchLabel}
                onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    clearQuery()
                    setSearchOpen(false)
                    event.currentTarget
                      .closest('.package-library')
                      ?.querySelector<HTMLButtonElement>('.package-search-toggle')
                      ?.focus()
                  }
                }}
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input autoFocus placeholder={searchLabel} />
                  <SearchField.ClearButton aria-label={t('packages.clearSearch')} />
                </SearchField.Group>
              </SearchField>
            </motion.div>
          )}
        </AnimatePresence>

        {mode === 'installed' ? (
          <PackageUpdateSummary {...updates} />
        ) : (
          <>
            <Tabs
              selectedKey={sort}
              className="package-sort"
              onSelectionChange={(key) => changeSort(key as typeof sort)}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label={t('packages.discover')}>
                  <Tabs.Tab id="downloads">
                    <Flame />
                    {t('packages.popular')}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="recent">
                    <Clock3 />
                    {t('packages.recent')}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
            <ToggleButtonGroup
              className="package-categories"
              aria-label={t('packages.categories')}
              selectionMode="single"
              disallowEmptySelection
              isDetached
              size="sm"
              selectedKeys={[category || 'all']}
              onSelectionChange={(keys) => {
                const key = [...keys][0]
                if (key != null) changeCategory(key === 'all' ? '' : (key as typeof category))
              }}
            >
              {(['', 'extension', 'skill', 'prompt', 'theme'] as const).map((kind) => (
                <ToggleButton key={kind} id={kind || 'all'} variant="ghost">
                  {kind === ''
                    ? t('packages.categoryAll')
                    : t(
                        `packages.resource.${{ extension: 'extensions', skill: 'skills', prompt: 'prompts', theme: 'themes' }[kind] as 'extensions' | 'skills' | 'prompts' | 'themes'}`,
                      )}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </>
        )}
      </div>
      <PackageFeedback {...feedback} />
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
                  className="package-option"
                >
                  <PackageOption
                    name={packageName(pkg.source)}
                    installedLabel={
                      mode === 'discover' && installed && installed.enabled !== false
                        ? t('packages.installed')
                        : undefined
                    }
                    disabledLabel={
                      installed?.enabled === false ? t('packages.disabled') : undefined
                    }
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
      {mode === 'discover' && (page > 1 || hasNext) && (
        <Pagination className="package-pagination" size="sm" aria-label={t('packages.discover')}>
          <Pagination.Previous
            isDisabled={page <= 1 || loading}
            onPress={() => changePage(-1)}
            aria-label={t('packages.previousPage')}
          >
            <ChevronLeft />
          </Pagination.Previous>
          <Pagination.Summary>{t('packages.pageNumber', { page })}</Pagination.Summary>
          <Pagination.Next
            isDisabled={!hasNext || loading}
            onPress={() => changePage(1)}
            aria-label={t('packages.nextPage')}
          >
            <ChevronRight />
          </Pagination.Next>
        </Pagination>
      )}
    </section>
  )
}
