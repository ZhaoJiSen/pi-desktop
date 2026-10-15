import { Button, Modal } from '@heroui/react'
import { useState } from 'react'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import { renameSession } from '../../lib/desktop'
import { errorText } from '../../lib/utils'

export function RenameDialog({
  sessionId,
  open,
  onClose,
}: {
  sessionId: string
  open: boolean
  onClose: () => void
}) {
  const session = useWorkspace((state) => state.sessions.find((item) => item.id === sessionId))
  const [name, setName] = useState(session?.title || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = useT()
  async function save() {
    if (!session || !name.trim()) return
    setSaving(true)
    setError('')
    try {
      await renameSession(session.id, name)
      onClose()
    } catch (error) {
      setError(errorText(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !saving) onClose()
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="form-dialog rename-dialog">
          <Modal.Header>
            <Modal.Heading>{t('sessions.rename')}</Modal.Heading>
            <Modal.CloseTrigger aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            <form
              id="rename-form"
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
            >
              <label className="field-label">
                {t('common.name')}
                <input
                  className="field-input"
                  autoFocus
                  maxLength={100}
                  value={name}
                  required
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" className="rename-cancel" onPress={onClose} isDisabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              className="rename-save"
              type="submit"
              form="rename-form"
              isPending={saving}
              isDisabled={!name.trim()}
            >
              {t('common.save')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
