import { Button, Dropdown, Modal } from '@heroui/react'
import { Ellipsis, GitBranch, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { OverflowTooltip } from '../OverflowTooltip'
import { branchKind } from '../../lib/source/historyLabels'
import { useT } from '../../lib/i18n'
import { gitBranchAction, gitBranchState } from '../../lib/source/api'
import { branchReference, type BranchAction } from '../../lib/source/branches'
import type { GitBranch as Branch } from '../../lib/source/types'
import { errorText } from '../../lib/utils'
import { useSourceQuery } from './useSourceQuery'

/** Menus choose an operation; only the named confirmation can mutate the repository. */
export function GitBranchActions({
  projectPath,
  branch,
  tick,
  onChanged,
  trigger,
}: {
  projectPath: string
  branch: Branch
  tick: number
  onChanged: () => void
  trigger?: 'current' | 'choice'
}) {
  const t = useT()
  const [action, setAction] = useState<BranchAction | null>(null)
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const running = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)
  const state = useSourceQuery(
    action ? `branch-action:${projectPath}:${action}:${refresh}` : null,
    () => gitBranchState(projectPath),
    `${tick}:${refresh}:${action}`,
  )
  const current = state.data?.current ?? t('source.detachedHead')
  const title = (value: BranchAction) => t(`source.branchAction.${value}`)
  const values = { target: branch.name, current }
  const remoteSwitch = action === 'switch' && branch.remote
  const needsName = action === 'create' || remoteSwitch
  const aborting = action === 'abortMerge' || action === 'abortRebase'
  const requiresClean = action === 'merge' || action === 'rebase'
  const blocked =
    state.data &&
    !aborting &&
    (state.data.operation ||
      (requiresClean && state.data.dirty) ||
      ((!state.data.current || (state.data.current === branch.name && !branch.remote)) &&
        (action === 'merge' || action === 'rebase')))
  function open(next: BranchAction) {
    setError('')
    setNotice('')
    setName(
      next === 'switch' && branch.remote ? branch.name.slice(branch.name.indexOf('/') + 1) : '',
    )
    setAction(next)
    setRefresh((value) => value + 1)
  }
  async function run() {
    if (!action || !state.data || blocked || running.current) return
    running.current = true
    setPending(true)
    setError('')
    try {
      await gitBranchAction(projectPath, {
        action,
        target: branchReference(branch),
        targetTip: branch.tip,
        name: name.trim(),
        expectedHead: state.data.head,
        expectedBranch: state.data.current,
      })
      setNotice(t('source.branchActionDone', { action: title(action), target: branch.name }))
      setAction(null)
      onChanged()
    } catch (caught) {
      setError(errorText(caught))
      setRefresh((value) => value + 1)
      onChanged()
    } finally {
      running.current = false
      setPending(false)
    }
  }
  return (
    <>
      <Dropdown>
        <Button
          isIconOnly={!trigger}
          variant={trigger === 'current' ? 'secondary' : 'ghost'}
          size="sm"
          className={trigger ? 'git-current-branch-picker' : 'git-branch-actions'}
          aria-label={
            trigger === 'current'
              ? `${t('source.currentBranch')}: ${branch.name}`
              : t('source.branchActionsFor', { branch: branch.name })
          }
        >
          {trigger ? (
            <>
              <GitBranch className="git-kind" data-kind={branchKind(branch.name)} />
              <OverflowTooltip text={branch.name} />
              <Ellipsis />
            </>
          ) : (
            <Ellipsis />
          )}
        </Button>
        <Dropdown.Popover className="action-popover git-branch-menu" placement="bottom end">
          <Dropdown.Menu
            aria-label={t('source.branchActionsFor', { branch: branch.name })}
            onAction={(key) => open(String(key) as BranchAction)}
          >
            <Dropdown.Item id="switch" isDisabled={branch.current}>
              {title('switch')}
            </Dropdown.Item>
            <Dropdown.Item id="create">{t('source.createFromBranch')}</Dropdown.Item>
            <Dropdown.Item id="merge" isDisabled={branch.current}>
              {t('source.mergeIntoCurrent')}
            </Dropdown.Item>
            <Dropdown.Item id="rebase" isDisabled={branch.current}>
              {t('source.rebaseOntoBranch')}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {notice && (
        <div className="git-operation-announcement" role="status">
          {notice}
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t('common.close')}
            onPress={() => setNotice('')}
          >
            <X />
          </Button>
        </div>
      )}
      <Modal.Backdrop
        isOpen={Boolean(action)}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null)
        }}
        className="dialog-backdrop"
        isDismissable={!pending}
      >
        <Modal.Container size="sm">
          <Modal.Dialog className="form-dialog git-branch-dialog">
            <Modal.Header>
              <Modal.Heading>{action ? title(action) : ''}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="git-branch-operation-target">
                {action && t(`source.branchDescription.${action}`, values)}
              </p>
              {needsName && (
                <label className="field-label">
                  {t('source.branchName')}
                  <input
                    className="field-input"
                    autoFocus
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={160}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={pending}
                  />
                </label>
              )}
              {action === 'rebase' && <p className="source-note">{t('source.rebaseWarning')}</p>}
              {state.loading && <p role="status">{t('source.loading')}</p>}
              {state.error && (
                <p className="git-branch-error" role="alert">
                  {state.error}
                </p>
              )}
              {state.data?.dirty && requiresClean && !state.data.operation && (
                <p className="git-branch-error" role="alert">
                  {t('source.branchDirty')}
                </p>
              )}
              {state.data?.dirty && !requiresClean && !aborting && !state.data.operation && (
                <p className="source-note">{t('source.keepWorkingChanges')}</p>
              )}
              {state.data?.operation && (
                <div className="git-operation-recovery">
                  <p role="status">
                    {t(
                      state.data.operation === 'merge'
                        ? 'source.mergeInProgress'
                        : 'source.rebaseInProgress',
                    )}
                  </p>
                  {!aborting && (
                    <Button
                      variant="secondary"
                      onPress={() =>
                        open(state.data?.operation === 'merge' ? 'abortMerge' : 'abortRebase')
                      }
                      isDisabled={pending}
                    >
                      {title(state.data.operation === 'merge' ? 'abortMerge' : 'abortRebase')}
                    </Button>
                  )}
                </div>
              )}
              {error && (
                <p className="git-branch-error" role="alert">
                  {error}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" isDisabled={pending} onPress={() => setAction(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                isPending={pending}
                isDisabled={
                  !state.data ||
                  Boolean(state.error || error || blocked) ||
                  (needsName && !name.trim())
                }
                onPress={() => void run()}
              >
                {action ? title(action) : ''}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  )
}
