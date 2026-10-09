import { Button, Modal } from '@heroui/react'
import { useState } from 'react'
import { useT } from '../lib/i18n'
import { useWorkspace } from '../store/workspace'

export function RenameProjectDialog({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const project = useWorkspace((state) => state.projects.find((item) => item.id === projectId))
  const [name, setName] = useState(project?.name || '')
  const t = useT()
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="form-dialog rename-dialog">
          <Modal.Header>
            <Modal.Heading>{t('projects.rename')}</Modal.Heading>
            <Modal.CloseTrigger aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            <form
              id="rename-project-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (!project || !name.trim()) return
                useWorkspace.getState().renameProject(projectId, name)
                onClose()
              }}
            >
              <label className="field-label">
                {t('projects.name')}
                <input
                  className="field-input"
                  autoFocus
                  required
                  maxLength={100}
                  value={name}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" className="rename-cancel" onPress={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              className="rename-save"
              type="submit"
              form="rename-project-form"
              isDisabled={!project || !name.trim()}
            >
              {t('common.save')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
