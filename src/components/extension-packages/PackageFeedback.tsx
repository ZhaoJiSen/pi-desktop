import { Alert, Button } from '@heroui/react'
import { RotateCw } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { PackageLoadingIcon } from './PackageLoadingIcon'

import { useT } from '../../lib/i18n'
import type { ExtensionPackagesController } from './useExtensionPackages'

type Props = ExtensionPackagesController['feedback']
const MotionAlert = motion.create(Alert)

export function PackageFeedback({
  error,
  notice,
  changed,
  removing,
  busy,
  running,
  retryOperation,
  reload,
  reloadFailed,
}: Props) {
  const t = useT()
  const reduced = useReducedMotion()
  if (!error && !notice && !changed) return null
  return (
    <MotionAlert
      status={error ? 'danger' : 'default'}
      className={`package-feedback ${error ? 'is-error' : ''}`}
      role={error ? 'alert' : 'status'}
      initial={reduced ? false : { opacity: 0, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
    >
      <Alert.Content>
        <Alert.Description>{error || notice || t('packages.reloadHint')}</Alert.Description>
      </Alert.Content>
      {error && !removing && !reloadFailed && (
        <Button variant="ghost" isDisabled={Boolean(busy)} onPress={retryOperation}>
          {t('packages.retry')}
        </Button>
      )}
      {changed && (
        <Button
          className="package-reload"
          variant="ghost"
          isDisabled={(Boolean(busy) && busy !== 'reload') || running}
          isPending={busy === 'reload'}
          onPress={() => void reload()}
        >
          {busy === 'reload' ? <PackageLoadingIcon /> : <RotateCw />}
          {t(busy === 'reload' ? 'packages.reloading' : 'packages.reload')}
        </Button>
      )}
    </MotionAlert>
  )
}
