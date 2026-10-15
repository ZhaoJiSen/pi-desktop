import { useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { SearchField, Tabs } from '@heroui/react'
import { ArrowUpRight, RotateCw, Search, X } from 'lucide-react'
import { useT } from '../../../lib/i18n'
import { PackageToolButton } from '../PackageToolButton'
import { PackageLoadingIcon } from '../PackageLoadingIcon'
import { PackageUpdateSummary } from '../PackageUpdateSummary'
import { PackageFilters } from './PackageFilters'
import type { PackageLibraryProps } from './types'

export function PackageLibraryControls({
  mode,
  packageCount,
  changeMode,
  query,
  sort,
  category,
  busy,
  path,
  changeQuery,
  clearQuery,
  changeSort,
  changeCategory,
  openPage,
  updates,
}: Pick<
  PackageLibraryProps,
  | 'mode'
  | 'packageCount'
  | 'changeMode'
  | 'query'
  | 'sort'
  | 'category'
  | 'busy'
  | 'path'
  | 'changeQuery'
  | 'clearQuery'
  | 'changeSort'
  | 'changeCategory'
  | 'openPage'
  | 'updates'
>) {
  const t = useT()
  const reduced = useReducedMotion()
  const [searchOpen, setSearchOpen] = useState(false)
  const searchLabel = t(
    mode === 'installed' ? 'packages.installedSearch' : 'packages.discoverSearch',
  )
  return (
    <div className="package-library-controls">
      <div className="package-library-heading">
        <h2 className="package-library-title">{t('navigation.extensions')}</h2>
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
              {updates.checking ? <PackageLoadingIcon /> : <RotateCw />}
            </PackageToolButton>
          ) : (
            <PackageToolButton label={t('packages.officialCatalog')} onPress={() => openPage()}>
              <ArrowUpRight />
            </PackageToolButton>
          )}
        </div>
      </div>
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
      </div>

      {mode === 'discover' && (
        <PackageFilters
          sort={sort}
          category={category}
          changeSort={changeSort}
          changeCategory={changeCategory}
        />
      )}
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
      {mode === 'installed' && <PackageUpdateSummary {...updates} />}
    </div>
  )
}
