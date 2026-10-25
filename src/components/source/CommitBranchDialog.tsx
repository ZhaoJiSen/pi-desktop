import { Button, Modal } from '@heroui/react'
import { useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitBranchState, gitCommitBranch } from '../../lib/source/api'
import { errorText } from '../../lib/utils'

export function CommitBranchDialog({
  open,
  projectPath,
  fromBranch,
  files,
  onClose,
  onCommitted,
  onChanged,
}: {
  open: boolean
  projectPath: string
  fromBranch?: string
  files: string[]
  onClose: () => void
  onCommitted: () => void
  onChanged?: () => void
}) {
  const t = useT()
  const [branch, setBranch] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const [continuation, setContinuation] = useState<{
    branch: string
    head: string | null
    current: string | null
  } | null>(null)
  const resuming = continuation?.branch === branch.trim() ? continuation : null
  async function save() {
    if (!branch.trim() || !message.trim() || !files.length || busy.current) return
    busy.current = true
    setSaving(true)
    setError('')
    const target = branch.trim()
    let before: { head: string | null; current: string | null } | null = null
    try {
      before = await gitBranchState(projectPath)
      if (
        (resuming && (before.current !== resuming.current || before.head !== resuming.head)) ||
        (!resuming && fromBranch !== undefined && before.current !== fromBranch)
      )
        throw new Error(t('source.commitChanged'))
      await gitCommitBranch(projectPath, target, message.trim(), files, {
        head: before.head,
        current: before.current,
        resume: Boolean(resuming),
      })
      setContinuation(null)
      setBranch('')
      setMessage('')
      onCommitted()
      onClose()
    } catch (caught) {
      setError(errorText(caught))
      try {
        const actual = await gitBranchState(projectPath)
        if (
          before &&
          (!resuming || (before.head === resuming.head && before.current === resuming.current)) &&
          actual.head === before.head &&
          actual.current === target &&
          (resuming || before.current !== target)
        ) {
          setContinuation({ branch: target, head: actual.head, current: actual.current })
        }
      } catch {
        // Keep the original failure and user input if the follow-up read also fails.
      }
      onChanged?.()
    } finally {
      busy.current = false
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
            <Modal.CloseTrigger aria-label={t('common.close')} isDisabled={saving} />
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
                  disabled={saving}
                  value={branch}
                  onChange={(event) => {
                    setBranch(event.target.value)
                    setContinuation(null)
                  }}
                />
              </label>
              <label className="field-label">
                {t('source.commitMessage')}
                <textarea
                  className="field-input commit-message"
                  rows={3}
                  maxLength={2000}
                  disabled={saving}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              {resuming && <p className="source-note">{t('source.commitRetryHint')}</p>}
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
