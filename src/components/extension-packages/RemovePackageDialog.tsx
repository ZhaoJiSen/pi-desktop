import { Button, Modal } from '@heroui/react'
import { packageName } from '../../lib/packages'

import { useT } from '../../lib/i18n'
import type { ExtensionPackagesController } from './useExtensionPackages'

type Props = ExtensionPackagesController['removeDialog']

export function RemovePackageDialog({ removing, busy, running, error, close, confirm }: Props) {
  const t = useT()
  return (
    <Modal.Backdrop
      isOpen={Boolean(removing)}
      onOpenChange={(open) => {
        if (!open && !busy) close()
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
              onPress={close}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              className="remove-confirm"
              isPending={busy === 'remove'}
              isDisabled={Boolean(busy) || running}
              onPress={confirm}
            >
              {t('packages.remove')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
