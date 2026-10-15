import { Button, Modal } from '@heroui/react'
import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n'
import { extensionResponse } from '../../lib/desktop'
import { errorText } from '../../lib/utils'
import type { ExtensionRequest } from '../../types'

export function ExtensionDialog({
  current,
  onClose,
}: {
  current: ExtensionRequest
  onClose: () => void
}) {
  const [value, setValue] = useState(current.prefill || '')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const t = useT()
  async function respond(payload: Record<string, unknown>) {
    if (sending) return
    setSending(true)
    try {
      await extensionResponse(current.id, payload)
      onClose()
    } catch (error) {
      setError(errorText(error))
      setSending(false)
    }
  }
  useEffect(() => {
    if (!current.timeout) return
    const timer = setTimeout(() => {
      void extensionResponse(current.id, { cancelled: true }).catch(() => {})
      onClose()
    }, current.timeout)
    return () => clearTimeout(timer)
  }, [current.id, current.timeout, onClose])
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) void respond({ cancelled: true })
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="md">
        <Modal.Dialog className="form-dialog">
          <Modal.Header>
            <Modal.Heading>{current.title}</Modal.Heading>
            <Modal.CloseTrigger aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            {current.message && <p>{current.message}</p>}
            {current.method === 'select'
              ? current.options?.map((option) => (
                  <Button
                    key={option}
                    variant="ghost"
                    className="menu-row"
                    onPress={() => void respond({ value: option })}
                    isDisabled={sending}
                  >
                    {option}
                  </Button>
                ))
              : current.method !== 'confirm' && (
                  <textarea
                    className="field-input extension-input"
                    autoFocus
                    aria-label={current.title}
                    placeholder={current.placeholder}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="ghost"
              onPress={() =>
                void respond(
                  current.method === 'confirm' ? { confirmed: false } : { cancelled: true },
                )
              }
            >
              {t('common.cancel')}
            </Button>
            {current.method !== 'select' && (
              <Button
                isPending={sending}
                onPress={() =>
                  void respond(current.method === 'confirm' ? { confirmed: true } : { value })
                }
              >
                {t('common.save')}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
