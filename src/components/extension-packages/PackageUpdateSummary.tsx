import { Alert, Button, ProgressBar } from '@heroui/react'
import { PackageLoadingIcon } from './PackageLoadingIcon'
import { useT } from '../../lib/i18n'
import type { ExtensionPackagesController } from './useExtensionPackages'

type Props = ExtensionPackagesController['library']['updates']

export function PackageUpdateSummary({
  checking,
  busy,
  path,
  running,
  batchDone,
  batchStates,
  updates,
  checked,
  checkErrors,
  unknown,
  checkSummary,
  checkUpdates,
  updateAll,
}: Props) {
  const t = useT()
  const progressLabel = t('packages.updateProgress', {
    done: batchDone,
    total: Object.keys(batchStates).length,
  })
  return (
    <div className="package-update-summary" aria-live="polite">
      <div className="package-update-overview">
        <span>
          {busy === 'batch' ? (
            progressLabel
          ) : checking ? (
            <>{t('packages.checking')}</>
          ) : updates ? (
            t('packages.updatesFound', { count: updates })
          ) : checked ? (
            checkSummary.status === 'partial' ? (
              t('packages.checkPartial', { count: checkSummary.compared })
            ) : checkSummary.status === 'failed' ? (
              t('packages.checkNoneSucceeded')
            ) : checkSummary.status === 'unavailable' ? (
              t('packages.checkUnavailable')
            ) : checkSummary.status === 'empty' ? (
              t('packages.noPackages')
            ) : (
              t('packages.checkCurrent')
            )
          ) : (
            t('packages.selectHint')
          )}
        </span>
        {(updates > 0 || busy === 'batch') && (
          <Button
            className="package-primary"
            isPending={busy === 'batch'}
            isDisabled={(Boolean(busy) && busy !== 'batch') || checking || running || !path}
            onPress={() => void updateAll()}
          >
            {busy === 'batch' && <PackageLoadingIcon />}
            {t(busy === 'batch' ? 'packages.updating' : 'packages.updateAll')}
          </Button>
        )}
      </div>
      {busy === 'batch' && (
        <ProgressBar
          className="package-update-progress package-batch-progress"
          aria-label={progressLabel}
          value={batchDone}
          maxValue={Math.max(1, Object.keys(batchStates).length)}
          isIndeterminate={batchDone === 0}
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      )}
      {!checking && Object.keys(checkErrors).length > 0 && (
        <Alert status="danger" className="package-check-error" role="alert">
          <Alert.Content>
            <Alert.Description>
              {t('packages.checkFailed', { count: Object.keys(checkErrors).length })}
            </Alert.Description>
          </Alert.Content>
          <Button variant="ghost" isDisabled={Boolean(busy)} onPress={() => void checkUpdates()}>
            {t('packages.retry')}
          </Button>
        </Alert>
      )}
      {busy !== 'batch' && !checking && unknown > 0 && (
        <small>{t('packages.checkUnknown', { count: unknown })}</small>
      )}
    </div>
  )
}
