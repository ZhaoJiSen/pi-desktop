import { Button, Modal } from '@heroui/react'
import { HoverScrollArea } from '../HoverScrollArea'
import { OverflowTooltip } from '../OverflowTooltip'
import { ConflictEditor } from './GitConflictEditor'
import type { useGitRemoteSync } from './useGitRemoteSync'

export function GitRecoveryDialog({
  recovery,
  pending,
  editing,
  setRecovery,
  setConfirm,
  t,
  projectPath,
  setNotice,
  onChanged,
  setEditing,
  confirm,
  operationName,
  state,
  operation,
  notice,
  onShowChanges,
  error,
  run,
}: Pick<
  ReturnType<typeof useGitRemoteSync>,
  | 'recovery'
  | 'pending'
  | 'editing'
  | 'setRecovery'
  | 'setConfirm'
  | 't'
  | 'setNotice'
  | 'setEditing'
  | 'confirm'
  | 'operationName'
  | 'state'
  | 'operation'
  | 'notice'
  | 'error'
  | 'run'
> & {
  projectPath: string
  onChanged: () => void
  onShowChanges: () => void
}) {
  return (
    <Modal.Backdrop
      isOpen={recovery}
      onOpenChange={(open) => {
        if (!pending && !editing) {
          setRecovery(open)
          setConfirm(null)
        }
      }}
      isDismissable={!pending && !editing}
      className="dialog-backdrop"
    >
      <Modal.Container size={editing ? 'lg' : 'md'}>
        <Modal.Dialog className="form-dialog git-sync-dialog">
          <Modal.Header>
            <Modal.Heading>
              {editing
                ? t('source.conflictEditor', { file: editing })
                : t('source.resolveConflicts')}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {editing ? (
              <ConflictEditor
                key={editing}
                projectPath={projectPath}
                path={editing}
                onSaved={() => {
                  setNotice(t('source.resolutionSaved'))
                  onChanged()
                }}
                onClose={() => setEditing(null)}
              />
            ) : confirm ? (
              <p>
                {confirm.action === 'abort'
                  ? t('source.abortConfirm', { operation: operationName })
                  : t('source.markResolvedConfirm', { file: confirm.relative! })}
              </p>
            ) : (
              <>
                <p>
                  {state?.conflicts.length
                    ? t('source.conflictCount', { count: state.conflicts.length })
                    : operation
                      ? t('source.operationReady')
                      : notice || t('source.operationComplete')}
                </p>
                <HoverScrollArea className="git-conflict-list" label={t('source.resolveConflicts')}>
                  {state?.conflicts.map((file) => (
                    <div className="git-conflict-row" key={file}>
                      <OverflowTooltip text={file} />
                      <Button
                        size="sm"
                        variant="ghost"
                        isDisabled={Boolean(pending)}
                        onPress={() => setEditing(file)}
                      >
                        {t('source.editConflict')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        isDisabled={Boolean(pending)}
                        onPress={() =>
                          setConfirm({ action: 'resolve', relative: file, snapshot: state! })
                        }
                      >
                        {t('source.markResolved')}
                      </Button>
                    </div>
                  ))}
                </HoverScrollArea>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    onShowChanges()
                    setRecovery(false)
                  }}
                >
                  {t('source.showConflictChanges')}
                </Button>
              </>
            )}
            {!editing && !confirm && operation && notice && <p role="status">{notice}</p>}
            {!editing && error && (
              <p role="alert" className="git-branch-error">
                {error}
              </p>
            )}
          </Modal.Body>
          {!editing && (
            <Modal.Footer>
              {confirm ? (
                <>
                  <Button
                    variant="ghost"
                    isDisabled={Boolean(pending)}
                    onPress={() => setConfirm(null)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant={confirm.action === 'abort' ? 'danger' : 'primary'}
                    isPending={Boolean(pending)}
                    onPress={() => void run(confirm.action, confirm.snapshot, confirm.relative)}
                  >
                    {confirm.action === 'abort'
                      ? t('source.abortOperation', { operation: operationName })
                      : t('source.markResolved')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    isDisabled={Boolean(pending)}
                    onPress={() => setRecovery(false)}
                  >
                    {t('common.close')}
                  </Button>
                  {operation && (
                    <>
                      <Button
                        variant="ghost"
                        isDisabled={Boolean(pending)}
                        onPress={() => setConfirm({ action: 'abort', snapshot: state! })}
                      >
                        {t('source.abortOperation', { operation: operationName })}
                      </Button>
                      <Button
                        variant="primary"
                        isDisabled={Boolean(state?.conflicts.length)}
                        isPending={pending === 'continue'}
                        onPress={() => void run('continue')}
                      >
                        {t('source.continueOperation', { operation: operationName })}
                      </Button>
                    </>
                  )}
                </>
              )}
            </Modal.Footer>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
