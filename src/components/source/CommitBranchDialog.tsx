import { Button, Modal } from '@heroui/react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitCommitBranch } from '../../lib/source/api'
import { errorText } from '../../lib/utils'

export function CommitBranchDialog({
  open,
  projectPath,
  fromBranch,
  files,
  onClose,
  onCommitted,
}: {
  open: boolean
  projectPath: string
  fromBranch?: string
  files: string[]
  onClose: () => void
  onCommitted: () => void
}) {
  const t = useT()
  const [branch, setBranch] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    if (!branch.trim() || !message.trim() || !files.length) return
    setSaving(true)
    setError('')
    try {
      await gitCommitBranch(projectPath, branch.trim(), message.trim(), files)
      onCommitted()
      onClose()
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }
  const ready = Boolean(branch.trim() && message.trim() && files.length)
  const scope = fromBranch
    ? files.length === 1
      ? t('source.commitOneOn', { branch: fromBranch })
      : t('source.commitManyOn', { count: files.length, branch: fromBranch })
    : files.length === 1
      ? t('source.commitOne')
      : t('source.commitMany', { count: files.length })
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !saving) onClose()
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="form-dialog commit-dialog">
          <Modal.Header>
            <div className="commit-intro">
              <Modal.Heading>{t('source.commitBranch')}</Modal.Heading>
              <p className="commit-scope">{scope}</p>
            </div>
            <Modal.CloseTrigger aria-label={t('common.close')} />
          </Modal.Header>
          <Modal.Body>
            <form
              id="commit-branch-form"
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  void save()
                }
              }}
            >
              <label className="field-label">
                {t('source.branchName')}
                <input
                  className="field-input commit-branch"
                  autoFocus
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={80}
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </label>
              <label className="field-label">
                {t('source.commitMessage')}
                <textarea
                  className="field-input commit-message"
                  rows={3}
                  maxLength={2000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
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
            <Button variant="ghost" className="commit-cancel" onPress={onClose} isDisabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              className="commit-save"
              type="submit"
              form="commit-branch-form"
              isPending={saving}
              isDisabled={!ready}
            >
              {t('source.commit')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
