import { AlertDialog, Button } from '@heroui/react'
import { useId, useLayoutEffect } from 'react'
import { useT } from '../lib/i18n'

export function RemoveConfirmationDialog({
  title,
  name,
  detail,
  description,
  confirmLabel,
  pending = false,
  error,
  onClose,
  onConfirm,
}: {
  title: string
  name: string
  detail?: string
  description: string
  confirmLabel: string
  pending?: boolean
  error?: string
  onClose: () => void
  onConfirm: () => void
}) {
  const t = useT()
  const descriptionId = useId()
  const dialogId = useId()
  // The dialog is the initial focus target so neither action opens selected.
  useLayoutEffect(() => {
    document.getElementById(dialogId)?.focus({ preventScroll: true })
  }, [dialogId])
  return (
    <AlertDialog.Backdrop
      isOpen
      isKeyboardDismissDisabled={pending}
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      className="dialog-backdrop"
    >
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog
          id={dialogId}
          className="remove-dialog"
          aria-describedby={descriptionId}
        >
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="remove-dialog-name">{name}</p>
            {detail && <p className="remove-dialog-detail">{detail}</p>}
            <p id={descriptionId} className="remove-dialog-description">
              {description}
            </p>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="secondary" onPress={onClose} isDisabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onPress={onConfirm} isPending={pending} isDisabled={pending}>
              {confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
