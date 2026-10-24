import { Button, Modal, Radio, RadioGroup, Spinner } from '@heroui/react'
import type { GitPullMode } from '../../lib/source/types'
import type { useGitRemoteSync } from './useGitRemoteSync'

export function GitPullDialog({
  pull,
  pending,
  setPull,
  t,
  mode,
  setMode,
  error,
  run,
}: Pick<
  ReturnType<typeof useGitRemoteSync>,
  'pull' | 'pending' | 'setPull' | 't' | 'mode' | 'setMode' | 'error' | 'run'
>) {
  return (
    <Modal.Backdrop
      isOpen={Boolean(pull)}
      onOpenChange={(open) => {
        if (!open && !pending) setPull(null)
      }}
      isDismissable={!pending}
      className="dialog-backdrop"
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="form-dialog git-sync-dialog">
          <Modal.Header>
            <Modal.Heading>{t('source.pullTitle')}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {pull && (
              <>
                <p>
                  {t('source.pullDescription', {
                    branch: pull.branch.current ?? t('source.detachedHead'),
                    upstream: pull.upstream ?? '—',
                  })}
                </p>
                {pull.branch.dirty ||
                pull.branch.operation ||
                !pull.upstream ||
                !pull.remote ||
                !pull.branch.current ? (
                  <p className="git-branch-error">
                    {!pull.remote
                      ? t('source.noRemote')
                      : !pull.upstream || !pull.branch.current
                        ? t('source.noUpstream')
                        : pull.branch.operation
                          ? t('source.syncPending')
                          : t('source.syncDirty')}
                  </p>
                ) : (
                  <RadioGroup
                    className="git-pull-modes"
                    aria-label={t('source.pull')}
                    name="pull-mode"
                    value={mode}
                    onChange={(value) => setMode(value as GitPullMode)}
                    isDisabled={Boolean(pending)}
                  >
                    {(['ffOnly', 'merge', 'rebase'] as const).map((value) => (
                      <Radio key={value} value={value} className="git-pull-mode">
                        <Radio.Content className="git-pull-mode-content">
                          <Radio.Control>
                            <Radio.Indicator />
                          </Radio.Control>
                          <span className="git-pull-mode-copy">
                            <strong>
                              {t(
                                value === 'ffOnly'
                                  ? 'source.pullFf'
                                  : value === 'merge'
                                    ? 'source.pullMerge'
                                    : 'source.pullRebase',
                              )}
                            </strong>
                            <small>
                              {t(
                                value === 'ffOnly'
                                  ? 'source.pullFfHelp'
                                  : value === 'merge'
                                    ? 'source.pullMergeHelp'
                                    : 'source.pullRebaseHelp',
                              )}
                            </small>
                          </span>
                        </Radio.Content>
                      </Radio>
                    ))}
                  </RadioGroup>
                )}
                {error && (
                  <p className="git-branch-error" role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" isDisabled={Boolean(pending)} onPress={() => setPull(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              isPending={pending === 'pull'}
              isDisabled={
                !pull ||
                Boolean(
                  pull.branch.dirty ||
                  pull.branch.operation ||
                  !pull.upstream ||
                  !pull.remote ||
                  !pull.branch.current,
                )
              }
              onPress={() => pull && void run('pull', pull, undefined, mode)}
            >
              {pending === 'pull' && (
                <Spinner size="sm" color="current" aria-hidden="true" role="presentation" />
              )}
              {t(pending === 'pull' ? 'source.pulling' : 'source.pull')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
