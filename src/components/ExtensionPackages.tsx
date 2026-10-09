import { Button, Modal, ScrollShadow, SearchField, Tabs, Chip, Spinner } from '@heroui/react'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Package,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createContext, useContext, useEffect, useState } from 'react'
import { useDebounce } from 'ahooks'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { connectSession, refreshExtensionPackages } from '../lib/desktop'
import {
  discoverPackages,
  hasUpdate,
  managePackage,
  npmName,
  openPackagePage,
  packageInfo,
  packageMetadata,
  packageName,
  type PackageInfo,
} from '../lib/packages'
import { errorText } from '../lib/utils'
import type { ExtensionPackage } from '../types'

export const PackageServices = createContext({
  discoverPackages,
  packageInfo,
  packageMetadata,
  managePackage,
  refreshExtensionPackages,
})

const keyOf = (item: ExtensionPackage) => `${item.scope}:${item.source}`
const emptyInfo: Record<string, PackageInfo> = {}
const metadataSource = (path: string | undefined, packages: ExtensionPackage[]) =>
  JSON.stringify([path, packages.map(({ source, scope, version }) => [source, scope, version])])

export function ExtensionPackages() {
  const {
    discoverPackages,
    packageInfo,
    packageMetadata,
    managePackage,
    refreshExtensionPackages,
  } = useContext(PackageServices)
  const packages = useWorkspace((state) => state.packages)
  const active = useWorkspace((state) => state.activeSessionId)
  const path = useWorkspace(
    (state) =>
      state.projects.find(
        (project) =>
          project.id ===
          state.sessions.find((session) => session.id === state.activeSessionId)?.projectId,
      )?.path,
  )
  const running = useWorkspace(
    (state) => Boolean(state.runningSessionId) || state.connection === 'connecting',
  )
  const [mode, setMode] = useState<'installed' | 'discover'>('installed')
  const [query, setQuery] = useState('')
  const search = useDebounce(query.trim(), { wait: 300 })
  const [mobileDetail, setMobileDetail] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [catalogResult, setCatalogResult] = useState<{ key: string; items: PackageInfo[] } | null>(
    null,
  )
  const catalog = catalogResult?.items || []
  const infoSource = metadataSource(path, packages)
  const [infoCache, setInfoCache] = useState<{
    source: string
    items: Record<string, PackageInfo>
  }>({
    source: '',
    items: {},
  })
  const info = infoCache.source === infoSource ? infoCache.items : emptyInfo
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [failedOperation, setFailedOperation] = useState<{
    action: 'install' | 'update' | 'remove'
    target: ExtensionPackage
  } | null>(null)
  const [notice, setNotice] = useState('')
  const [changed, setChanged] = useState(false)
  const [removing, setRemoving] = useState<ExtensionPackage | null>(null)
  const [retry, setRetry] = useState(0)
  const loading = mode === 'discover' && catalogResult?.key !== `${search}:${retry}`
  const reduced = useReducedMotion()
  const t = useT()
  const items: ExtensionPackage[] =
    mode === 'installed'
      ? packages.filter((item) =>
          `${item.source} ${item.description || ''}`.toLowerCase().includes(search.toLowerCase()),
        )
      : catalog.map((item) => ({
          source: `npm:${item.name}`,
          scope: 'global',
          description: item.description,
        }))
  const item = items.find((item) => keyOf(item) === selected) || items[0]
  const name = item ? npmName(item.source) : null
  const detail = name ? info[name] || catalog.find((item) => item.name === name) : undefined
  const installed =
    item && (mode === 'installed' ? item : packages.find((pkg) => npmName(pkg.source) === name))
  const updateAvailable = installed && detail && hasUpdate(installed.version, detail)
  const pinned = installed && name && installed.source !== `npm:${name}`
  const updates = packages.filter((pkg) => {
    const name = npmName(pkg.source)
    return name && pkg.source === `npm:${name}` && info[name] && hasUpdate(pkg.version, info[name])
  }).length

  useEffect(() => {
    if (mode !== 'discover') return
    const controller = new AbortController()
    discoverPackages(search, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setCatalogResult({ key: `${search}:${retry}`, items: result })
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(errorText(error))
          setCatalogResult({ key: `${search}:${retry}`, items: [] })
        }
      })
    return () => controller.abort()
  }, [mode, search, retry, discoverPackages])

  useEffect(() => {
    if (!name || info[name]) return
    const controller = new AbortController()
    packageInfo(name, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setInfoCache((current) => ({
            source: infoSource,
            items: { ...(current.source === infoSource ? current.items : {}), [name]: result },
          }))
      })
      .catch(() => {
        /* The installed source remains available when registry metadata is offline. */
      })
    return () => controller.abort()
  }, [name, info, infoSource, retry, packageInfo])

  async function checkUpdates() {
    if (busy || !path) return
    setBusy('check')
    setFailedOperation(null)
    setError('')
    setNotice('')
    try {
      const fresh = await refreshExtensionPackages(path)
      const results: Record<string, PackageInfo> = {}
      for (const result of await packageMetadata(fresh)) results[result.name] = result
      const source = metadataSource(path, fresh)
      setInfoCache((current) => ({
        source,
        items: { ...(current.source === source ? current.items : {}), ...results },
      }))
      const count = fresh.filter((pkg) => {
        const name = npmName(pkg.source)
        return (
          name &&
          pkg.source === `npm:${name}` &&
          results[name] &&
          hasUpdate(pkg.version, results[name])
        )
      }).length
      setNotice(
        count
          ? t('packages.updatesFound', { count })
          : fresh.some((pkg) => !npmName(pkg.source) || !pkg.version)
            ? t('packages.versionUnavailable')
            : t('packages.upToDate'),
      )
    } catch (error) {
      setError(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  async function perform(action: 'install' | 'update' | 'remove', target: ExtensionPackage) {
    if (busy || running || !path) return
    setBusy(action)
    setFailedOperation(null)
    setError('')
    setNotice('')
    try {
      await managePackage(action, target, path)
      setChanged(true)
      await refreshExtensionPackages(path)
      setInfoCache({ source: '', items: {} })
      setNotice(
        t(
          action === 'install'
            ? 'packages.installedSuccess'
            : action === 'update'
              ? 'packages.updatedSuccess'
              : 'packages.removedSuccess',
          { name: packageName(target.source) },
        ),
      )
      setRemoving(null)
    } catch (error) {
      setFailedOperation({ action, target })
      setError(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  async function reload() {
    if (!active || busy || running) return
    setBusy('reload')
    setError('')
    try {
      await connectSession(active, true)
      setChanged(false)
    } catch (error) {
      setError(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div
      className="package-manager"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <header className="package-heading">
        <div>
          <h2>{t('extensions.packages')}</h2>
        </div>
        <Button
          variant="secondary"
          className="package-check"
          isPending={busy === 'check'}
          isDisabled={Boolean(busy) || !path}
          onPress={() => void checkUpdates()}
        >
          <RefreshCw />
          {t('packages.checkUpdates')}
        </Button>
      </header>
      <div className="package-toolbar">
        <Tabs
          selectedKey={mode}
          onSelectionChange={(key) => {
            setMode(key as typeof mode)
            setSelected(null)
            setMobileDetail(false)
            setQuery('')
            setError('')
            setNotice('')
          }}
          className="package-tabs"
        >
          <Tabs.List aria-label={t('extensions.packages')}>
            <Tabs.Tab id="installed">
              {t('packages.installed')}
              <span className="package-count">{packages.length}</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="discover">
              {t('packages.discover')}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <SearchField
          className="package-search"
          value={query}
          onChange={setQuery}
          aria-label={t('packages.search')}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t('packages.search')} />
            <SearchField.ClearButton aria-label={t('packages.clearSearch')} />
          </SearchField.Group>
        </SearchField>
      </div>
      {(error || notice || changed) && (
        <div
          className={`package-feedback ${error ? 'is-error' : ''}`}
          role={error ? 'alert' : 'status'}
        >
          <span>{error || notice || t('packages.reloadHint')}</span>
          {error && !removing && (
            <Button
              variant="ghost"
              isDisabled={Boolean(busy)}
              onPress={() => {
                if (failedOperation) {
                  void perform(failedOperation.action, failedOperation.target)
                } else {
                  setError('')
                  if (mode === 'discover') setRetry((value) => value + 1)
                  else void checkUpdates()
                }
              }}
            >
              {t('packages.retry')}
            </Button>
          )}
          {changed && !error && (
            <Button
              variant="ghost"
              isDisabled={Boolean(busy) || running}
              isPending={busy === 'reload'}
              onPress={() => void reload()}
            >
              {t('packages.reload')}
            </Button>
          )}
        </div>
      )}
      <div className={`package-workspace ${mobileDetail ? 'detail-open' : ''}`}>
        <section
          className="package-library"
          aria-label={mode === 'installed' ? t('packages.installed') : t('packages.discover')}
        >
          <div className="package-list-heading">
            <span>
              {mode === 'installed' ? t('packages.yourPackages') : t('packages.community')}
            </span>
            <small>
              {updates > 0 && mode === 'installed'
                ? t('packages.updatesFound', { count: updates })
                : mode === 'discover'
                  ? 'npm · pi-package'
                  : t('packages.selectHint')}
            </small>
          </div>
          <ScrollShadow className="package-scroll" hideScrollBar={false}>
            {loading ? (
              <div className="package-empty">
                <Spinner size="sm" />
                <p>{t('packages.loading')}</p>
              </div>
            ) : items.length ? (
              items.map((pkg) => {
                const pkgName = npmName(pkg.source)
                const metadata = pkgName
                  ? info[pkgName] || catalog.find((item) => item.name === pkgName)
                  : undefined
                const available =
                  pkgName && pkg.source === `npm:${pkgName}` && hasUpdate(pkg.version, metadata)
                return (
                  <Button
                    key={keyOf(pkg)}
                    variant="ghost"
                    className={`package-option ${item && keyOf(item) === keyOf(pkg) ? 'is-selected' : ''}`}
                    aria-pressed={item && keyOf(item) === keyOf(pkg)}
                    onPress={() => {
                      setSelected(keyOf(pkg))
                      setMobileDetail(true)
                      setError('')
                      setFailedOperation(null)
                    }}
                  >
                    <span className="package-monogram" aria-hidden="true">
                      {packageName(pkg.source).replace(/^pi-/, '').slice(0, 2).toUpperCase()}
                    </span>
                    <span className="package-option-copy">
                      <strong>{packageName(pkg.source)}</strong>
                      <small>
                        {mode === 'installed'
                          ? t(`extensions.scope.${pkg.scope}`)
                          : metadata?.author || 'npm'}
                        {pkg.version ? ` · v${pkg.version}` : ''}
                      </small>
                    </span>
                    {available ? (
                      <span
                        className="package-update-dot"
                        aria-label={t('packages.updateAvailable')}
                      />
                    ) : (
                      <ChevronRight />
                    )}
                  </Button>
                )
              })
            ) : (
              <div className="package-empty">
                <Package />
                <p>
                  {search
                    ? t('packages.noResults')
                    : mode === 'discover'
                      ? t('packages.noCatalog')
                      : t('packages.noPackages')}
                </p>
                {query && (
                  <Button variant="ghost" onPress={() => setQuery('')}>
                    {t('packages.clearSearch')}
                  </Button>
                )}
              </div>
            )}
          </ScrollShadow>
          <Button
            variant="ghost"
            className="package-catalog-link"
            onPress={() => {
              void openPackagePage().catch((error) => setError(errorText(error)))
            }}
          >
            {t('packages.officialCatalog')}
            <ArrowUpRight />
          </Button>
        </section>
        <ScrollShadow className="package-detail-scroll" hideScrollBar={false}>
          <AnimatePresence initial={false}>
            {item && !loading ? (
              <motion.article
                className="package-detail"
                key={`${keyOf(item)}:${mobileDetail}`}
                initial={reduced ? false : { opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, position: 'absolute', top: 0, width: '100%' }}
                transition={{ duration: reduced ? 0 : 0.12 }}
              >
                <Button
                  variant="ghost"
                  className="package-back"
                  onPress={() => setMobileDetail(false)}
                >
                  <ChevronLeft />
                  {t('packages.backToList')}
                </Button>
                <div className="package-detail-heading">
                  <div className="package-emblem">
                    <Package />
                  </div>
                  <Chip size="sm" variant="soft">
                    {installed ? t('packages.installed') : t('packages.community')}
                  </Chip>
                </div>
                <h3>{packageName(item.source)}</h3>
                <p className="package-description">
                  {detail?.description || item.description || t('packages.noDescription')}
                </p>
                <div className="package-actions">
                  {installed ? (
                    <>
                      {name && (
                        <Button
                          className={updateAvailable ? 'package-primary' : 'package-secondary'}
                          isDisabled={
                            Boolean(busy) || running || !path || Boolean(pinned) || !updateAvailable
                          }
                          isPending={busy === 'update'}
                          onPress={() => void perform('update', installed)}
                        >
                          <RefreshCw />
                          {updateAvailable
                            ? t('packages.updateTo', { version: detail?.version || '' })
                            : installed.version && installed.version === detail?.version
                              ? t('packages.currentVersion')
                              : t('packages.update')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        className="package-remove"
                        isDisabled={Boolean(busy) || running || !path}
                        onPress={() => {
                          setError('')
                          setRemoving(installed)
                        }}
                      >
                        <Trash2 />
                        {t('packages.remove')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="package-primary"
                      isPending={busy === 'install'}
                      isDisabled={Boolean(busy) || running || !path}
                      onPress={() => void perform('install', item)}
                    >
                      <Download />
                      {t('packages.install')}
                    </Button>
                  )}
                </div>
                {installed && (
                  <p className="package-action-note">
                    {pinned
                      ? t('packages.pinnedHint')
                      : changed
                        ? t('packages.reloadHint')
                        : running
                          ? t('packages.runningHint')
                          : t('packages.manageHint')}
                  </p>
                )}
                {!installed && <p className="package-action-note">{t('packages.installHint')}</p>}
                <dl className="package-facts">
                  {installed && (
                    <div>
                      <dt>{t('packages.installedVersion')}</dt>
                      <dd>
                        {installed
                          ? installed.version
                            ? `v${installed.version}`
                            : t('packages.unknownVersion')
                          : '—'}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>{t('packages.latestVersion')}</dt>
                    <dd>{detail?.version ? `v${detail.version}` : '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('packages.author')}</dt>
                    <dd>{detail?.author || '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('packages.scope')}</dt>
                    <dd>{t(`extensions.scope.${installed?.scope || item.scope}`)}</dd>
                  </div>
                  <div>
                    <dt>{t('packages.license')}</dt>
                    <dd>{detail?.license || '—'}</dd>
                  </div>
                </dl>
                {Boolean(detail?.resources.length) && (
                  <section className="package-resources">
                    <h4>{t('packages.includes')}</h4>
                    <div>
                      {detail!.resources.map((resource) => (
                        <Chip key={resource} size="sm" variant="soft">
                          {t(
                            `packages.resource.${resource as 'extensions' | 'skills' | 'prompts' | 'themes'}`,
                          )}
                        </Chip>
                      ))}
                    </div>
                  </section>
                )}
                <section className="package-source">
                  <h4>{t('extensions.source')}</h4>
                  <code>{item.source}</code>
                  {name && (
                    <Button
                      variant="ghost"
                      onPress={() => {
                        void openPackagePage(name).catch((error) => setError(errorText(error)))
                      }}
                    >
                      {t('packages.viewDocumentation')}
                      <ArrowUpRight />
                    </Button>
                  )}
                </section>
              </motion.article>
            ) : (
              <div className="package-detail-empty">
                <Package />
                <p>{t('packages.detailHint')}</p>
              </div>
            )}
          </AnimatePresence>
        </ScrollShadow>
      </div>
      <Modal.Backdrop
        isOpen={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoving(null)
        }}
        className="dialog-backdrop"
        isDismissable={!busy}
      >
        <Modal.Container size="sm">
          <Modal.Dialog
            className="form-dialog remove-session-dialog package-remove-dialog"
            aria-label={t('packages.remove')}
          >
            <Modal.CloseTrigger isDisabled={Boolean(busy)} aria-label={t('common.close')} />
            <Modal.Header>
              <Modal.Heading>{t('packages.removeTitle')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="package-remove-name">{removing && packageName(removing.source)}</p>
              <p>
                {t('packages.removeHint', {
                  scope: removing ? t(`extensions.scope.${removing.scope}`) : '',
                })}
              </p>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="ghost"
                className="remove-cancel"
                isDisabled={Boolean(busy)}
                onPress={() => setRemoving(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                className="remove-confirm"
                isPending={busy === 'remove'}
                isDisabled={Boolean(busy) || running}
                onPress={() => removing && void perform('remove', removing)}
              >
                {t('packages.remove')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </motion.div>
  )
}
