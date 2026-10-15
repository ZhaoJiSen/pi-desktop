import { Button, Modal } from '@heroui/react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { navigateToPage } from '../../router/navigation'
import { openProject } from '../../lib/desktop'
import { errorText } from '../../lib/utils'

export function ProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const t = useT()
  function close() {
    if (pending) return
    onClose()
    setPath('')
    setError('')
  }
  async function add() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      if (await openProject(path)) {
        void navigateToPage('chat')
        onClose()
        setPath('')
      }
    } catch (error) {
      setError(errorText(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) close()
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="form-dialog">
          <Modal.Header>
            <Modal.Heading>{t('projects.add')}</Modal.Heading>
            <Modal.CloseTrigger aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            <form
              id="project-form"
              onSubmit={(event) => {
                event.preventDefault()
                void add()
              }}
            >
              <label className="field-label">
                {t('projects.path')}
                <input
                  className="field-input"
                  value={path}
                  onChange={(event) => {
                    setPath(event.target.value)
                    setError('')
                  }}
                  placeholder="~/Projects/my-project"
                  required
                  autoFocus
                  disabled={pending}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'project-path-error' : undefined}
                />
              </label>
            </form>
            {error && (
              <p id="project-path-error" className="dialog-error" role="alert">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={close} isDisabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="project-form" isDisabled={pending}>
              {t('projects.openFolder')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
