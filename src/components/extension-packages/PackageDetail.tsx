import { Button, Chip, ProgressBar, Switch } from '@heroui/react'
import {
  ArrowUpRight,
  ChevronLeft,
  Check,
  Download,
  Package,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { packageName } from '../../lib/packages'
import { packageKey as keyOf } from '../../lib/packageUpdates'

import { useT } from '../../lib/i18n'
import { PackageToolButton } from './PackageToolButton'
import { PackageLoadingIcon } from './PackageLoadingIcon'
import { PackageFeedback } from './PackageFeedback'
import { PackageScrollArea } from './PackageScrollArea'
import type { ExtensionPackagesController } from './useExtensionPackages'

type Props = ExtensionPackagesController['detail'] & Pick<ExtensionPackagesController, 'feedback'>

export function PackageDetail({
  item,
  loading,
  mobileDetail,
  name,
  detail,
  installed,
  updateAvailable,
  pinned,
  checkErrors,
  batchStates,
  busy,
  running,
  path,
  perform,
  openPage,
  backToList,
  requestRemove,
  feedback,
}: Props) {
  const t = useT()
  const reduced = useReducedMotion()
  const updating = Boolean(item && batchStates[keyOf(item)]?.status === 'updating')
  const progressStates = Object.values(batchStates)
  const completed = progressStates.filter(
    (state) => state.status === 'done' || state.status === 'failed',
  ).length
  const showProgress = busy === 'update'
  const progressLabel = t('packages.updating')
  return (
    <PackageScrollArea className="package-detail-scroll" label={t('packages.detailHint')}>
      <AnimatePresence initial={false} mode="wait">
        {item && !loading ? (
          <motion.article
            className="package-detail"
            key={`${keyOf(item)}:${mobileDetail}`}
            initial={reduced ? false : { opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.12 }}
          >
            <Button variant="ghost" className="package-back" onPress={backToList}>
              <ChevronLeft />
              {t('packages.backToList')}
            </Button>
            <div className="package-detail-heading">
              <div className="package-identity">
                <div className="package-emblem" aria-hidden="true">
                  <Package />
                </div>
                <div className="package-identity-copy">
                  <h3>{packageName(item.source)}</h3>
                  <div className="package-detail-status">
                    <Chip size="sm" variant="soft">
                      {installed
                        ? t(
                            installed.enabled === false
                              ? 'packages.disabled'
                              : 'packages.installed',
                          )
                        : t('packages.community')}
                    </Chip>
                    {installed?.version && installed.version === detail?.version && (
                      <span className="package-current">
                        <Check />
                        {t('packages.currentVersion')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="package-actions">
                {installed ? (
                  <>
                    {name && (updateAvailable || updating) && (
                      <Button
                        className={updateAvailable ? 'package-primary' : 'package-secondary'}
                        isDisabled={
                          (Boolean(busy) && !updating) ||
                          running ||
                          !path ||
                          Boolean(pinned) ||
                          (!updateAvailable && !updating)
                        }
                        isPending={updating}
                        onPress={() => void perform('update', installed)}
                      >
                        {updating ? <PackageLoadingIcon /> : <RefreshCw />}
                        {updating
                          ? t('packages.updating')
                          : updateAvailable
                            ? t('packages.updateTo', { version: detail?.version || '' })
                            : t('packages.update')}
                      </Button>
                    )}
                    <Switch
                      className="package-enable-switch"
                      size="sm"
                      isSelected={installed.enabled !== false}
                      isDisabled={Boolean(busy) || running || !path}
                      onChange={(enabled) =>
                        void perform(enabled ? 'enable' : 'disable', installed)
                      }
                      aria-label={t('packages.enable')}
                    >
                      <Switch.Content>
                        {t(installed.enabled === false ? 'packages.disabled' : 'packages.enabled')}
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                    <PackageToolButton
                      label={t('packages.remove')}
                      className="package-remove"
                      isDisabled={Boolean(busy) || running || !path}
                      onPress={() => requestRemove(installed)}
                    >
                      <Trash2 />
                    </PackageToolButton>
                  </>
                ) : (
                  <Button
                    className="package-primary"
                    isPending={busy === 'install'}
                    isDisabled={(Boolean(busy) && busy !== 'install') || running || !path}
                    onPress={() => void perform('install', item)}
                  >
                    {busy === 'install' ? <PackageLoadingIcon /> : <Download />}
                    {t(busy === 'install' ? 'packages.installing' : 'packages.install')}
                  </Button>
                )}
              </div>
            </div>
            {showProgress && (
              <ProgressBar
                className="package-update-progress"
                aria-label={progressLabel}
                value={completed}
                maxValue={Math.max(1, progressStates.length)}
                isIndeterminate={completed === 0}
              >
                <div className="package-progress-label">{progressLabel}</div>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            )}
            <div className="package-mobile-feedback">
              <PackageFeedback {...feedback} />
            </div>
            <p className="package-description">
              {detail?.description || item.description || t('packages.noDescription')}
            </p>
            {name && checkErrors[name] && (
              <p className="package-detail-error" role="alert">
                {checkErrors[name]}
              </p>
            )}
            {batchStates[keyOf(item)]?.error && (
              <p className="package-detail-error" role="alert">
                {batchStates[keyOf(item)].error}
              </p>
            )}
            {installed && (pinned || running) && (
              <p className="package-action-note">
                {pinned ? t('packages.pinnedHint') : t('packages.runningHint')}
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
                  className="package-documentation"
                  variant="ghost"
                  onPress={() => openPage(name)}
                >
                  {t('packages.viewDocumentation')}
                  <ArrowUpRight />
                </Button>
              )}
            </section>
          </motion.article>
        ) : (
          <div className="package-detail-empty">
            <Package aria-hidden="true" />
            <p>{t('packages.detailHint')}</p>
          </div>
        )}
      </AnimatePresence>
    </PackageScrollArea>
  )
}
