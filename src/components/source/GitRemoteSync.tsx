import {
  Button,
  Chip,
  Modal,
  Radio,
  RadioGroup,
  Separator,
  Spinner,
  Toolbar,
  Tooltip,
} from '@heroui/react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Check,
  CloudDownload,
  RefreshCw,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  gitConflictWrite,
  gitSyncAction,
  gitSyncState,
  readProjectFile,
} from '../../lib/source/api'
import { syncError, syncRequest } from '../../lib/source/sync'
import { useGitFetchInterval } from '../../hooks/useGitFetchInterval'
import type { GitPullMode, GitSyncAction, GitSyncState } from '../../lib/source/types'
import { useT } from '../../lib/i18n'
import { reportSuccessNotice } from '../../lib/notices'
import { useWorkspace } from '../../store/workspace'
import { OverflowTooltip } from '../OverflowTooltip'
import { HoverScrollArea } from '../HoverScrollArea'
import { SourceAction } from './SourceAction'
import { useSourceQuery } from './useSourceQuery'
import { GitOperationContext } from './GitOperationContext'
import { useGitRepositoryStatus } from './GitRepositoryStatus'

/** One controller per visible repository: background fetching never invalidates the loaded log. */
export function GitRemoteSync({
  projectPath,
  tick,
  children,
  repository,
  onChanged,
  onFetched,
  onShowChanges,
}: {
  projectPath: string
  tick: number
  children?: ReactNode
  repository?: ReactNode
  onChanged: () => void
  onFetched: () => void
  onShowChanges: () => void
}) {
  const t = useT()
  const language = useWorkspace((s) => s.language)
  const repositoryStatus = useGitRepositoryStatus()
  const usable =
    !repositoryStatus ||
    Boolean(repositoryStatus.status.data?.available && repositoryStatus.status.data.repo)
  const [snapshotState, setState] = useState<GitSyncState>()
  const state = usable ? snapshotState : undefined
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<GitSyncAction | null>(null)
  const minutes = useGitFetchInterval(projectPath)
  const [pull, setPull] = useState<GitSyncState | null>(null)
  const [mode, setMode] = useState<GitPullMode>('ffOnly')
  const [recovery, setRecovery] = useState(false)
  const [confirm, setConfirm] = useState<{
    action: 'resolve' | 'abort'
    relative?: string
    snapshot: GitSyncState
  } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const busy = useRef(false)
  const live = useRef(true)
  const sequence = useRef(0)
  const latest = useRef({ state, onChanged, onFetched, t })
  useLayoutEffect(() => {
    latest.current = { state, onChanged, onFetched, t }
  })
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const refresh = useCallback(async () => {
    if (!projectPath || !usable) return undefined
    const id = ++sequence.current
    try {
      const next = await gitSyncState(projectPath)
      if (live.current && id === sequence.current) setState(next)
      return next
    } catch (caught) {
      if (live.current && id === sequence.current) setError(syncError(caught, latest.current.t))
      return undefined
    }
  }, [projectPath, usable])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Refresh reads external Git state; all state updates happen after awaiting IPC.
    void refresh()
  }, [refresh, tick])
  useEffect(() => {
    const update = () => {
      if (!busy.current && document.visibilityState !== 'hidden') void refresh()
    }
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    const timer = window.setInterval(update, 15000)
    return () => {
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
      clearInterval(timer)
    }
  }, [refresh])
  const run = useCallback(
    async (
      action: GitSyncAction,
      snapshot?: GitSyncState,
      relative?: string,
      pullMode?: GitPullMode,
    ) => {
      const current = snapshot ?? latest.current.state
      if (!current || busy.current) return
      busy.current = true
      setPending(action)
      setError('')
      setNotice('')
      try {
        await gitSyncAction(projectPath, {
          action,
          ...syncRequest(current),
          relative,
          mode: pullMode,
        })
        if (!live.current) return
        const message = latest.current.t('source.syncDone', {
          action:
            action === 'fetch'
              ? 'Fetch'
              : action === 'pull'
                ? 'Pull'
                : action === 'resolve'
                  ? latest.current.t('source.markResolved')
                  : action === 'abort'
                    ? latest.current.t('source.abortOperation', {
                        operation:
                          current.branch.operation === 'rebase'
                            ? latest.current.t('source.pullRebase')
                            : latest.current.t('source.pullMerge'),
                      })
                    : latest.current.t('source.continueOperation', {
                        operation:
                          current.branch.operation === 'rebase'
                            ? latest.current.t('source.pullRebase')
                            : latest.current.t('source.pullMerge'),
                      }),
        })
        if (action === 'fetch' || action === 'pull') reportSuccessNotice(message)
        else setNotice(message)
        setPull(null)
        setConfirm(null)
      } catch (caught) {
        if (live.current) {
          setError(syncError(caught, latest.current.t))
          setConfirm(null)
        }
      } finally {
        if (live.current) {
          const next = await refresh()
          if (live.current) {
            const unchangedPull =
              action === 'pull' &&
              next &&
              next.branch.head === current.branch.head &&
              next.branch.current === current.branch.current &&
              next.branch.operation === current.branch.operation &&
              next.branch.dirty === current.branch.dirty &&
              next.conflicts.length === current.conflicts.length
            if (action === 'fetch' || unchangedPull) latest.current.onFetched()
            else {
              latest.current.onChanged()
              if (next?.branch.operation) {
                setPull(null)
                setRecovery(true)
              }
            }
            setPending(null)
          }
        }
        busy.current = false
      }
    },
    [projectPath, refresh],
  )
  const fetchAction = useCallback(() => {
    if (latest.current.state?.remote && !latest.current.state.branch.operation) void run('fetch')
  }, [run])
  const remote = state?.remote
  const operation = state?.branch.operation
  useEffect(() => {
    if (!minutes || !remote || operation) return
    const fetch = () => {
      if (document.visibilityState !== 'hidden' && navigator.onLine !== false) fetchAction()
    }
    const timer = window.setInterval(fetch, minutes * 60000)
    return () => clearInterval(timer)
  }, [minutes, remote, operation, fetchAction])
  const operationName = operation === 'rebase' ? t('source.pullRebase') : t('source.pullMerge')
  const lastFetch = state?.lastFetch
    ? new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(
        state.lastFetch,
      )
    : null
  const blocked =
    !state ||
    !remote ||
    !state.upstream ||
    !state.branch.current ||
    state.branch.dirty ||
    Boolean(operation)
  const pullBlockedReason = !remote
    ? t('source.noRemote')
    : !state?.upstream || !state.branch.current
      ? t('source.noUpstream')
      : operation
        ? t('source.syncPending')
        : state.branch.dirty
          ? t('source.syncDirty')
          : ''
  return (
    <GitOperationContext.Provider value={Boolean(operation || state?.conflicts.length)}>
      <header className="git-workspace-header">
        <h1 className="git-browser-title">{t('source.workspace')}</h1>
        <div
          className="git-workspace-action-bar"
          onKeyDownCapture={(event) => {
            if (
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
            )
              return
            const target = event.target as HTMLElement
            // Dropdown portals retain React ancestry; leave their own navigation alone.
            if (target.closest('[role="menu"], [role="listbox"], [role="dialog"]')) return
            const buttons = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                'button:not(:disabled):not([aria-disabled="true"])',
              ),
            ].filter((button) => !button.closest('[inert]'))
            const index = buttons.indexOf(target.closest('button')!)
            if (index < 0 || !buttons.length) return
            const step = event.key === 'ArrowRight' ? 1 : -1
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? buttons.length - 1
                  : (index + step + buttons.length) % buttons.length
            // Passive tooltip anchors are focusable to React Aria but are not separate actions.
            event.preventDefault()
            event.stopPropagation()
            buttons[next]?.focus()
          }}
        >
          <Toolbar
            className="git-workspace-tools"
            aria-label={t('source.repositoryActions')}
            isAttached
          >
            <div className="git-global-context" inert={Boolean(pending)}>
              {repository}
            </div>
            <Separator orientation="vertical" className="git-toolbar-divider" />
            {state?.upstream && (
              <Tooltip delay={450}>
                <Tooltip.Trigger<'span'>
                  render={(props) => <span {...props} />}
                  role={undefined}
                  tabIndex={0}
                  className="git-sync-counts"
                  aria-label={t('source.syncCounts', { behind: state.behind, ahead: state.ahead })}
                >
                  <Chip
                    size="sm"
                    variant="soft"
                    className="git-sync-trend"
                    data-direction="down"
                    data-empty={state.behind === 0}
                  >
                    <ArrowDown />
                    <Chip.Label>{state.behind}</Chip.Label>
                  </Chip>
                  <Chip
                    size="sm"
                    variant="soft"
                    className="git-sync-trend"
                    data-direction="up"
                    data-empty={state.ahead === 0}
                  >
                    <ArrowUp />
                    <Chip.Label>{state.ahead}</Chip.Label>
                  </Chip>
                </Tooltip.Trigger>
                <Tooltip.Content>
                  <strong>{state.upstream}</strong>
                  <br />
                  {t('source.syncCounts', { behind: state.behind, ahead: state.ahead })}
                  <br />
                  {t('source.pullScope')}
                </Tooltip.Content>
              </Tooltip>
            )}
            {state?.upstream && (
              <Separator orientation="vertical" className="git-toolbar-divider" />
            )}
            <div className="git-sync-actions">
              <Tooltip delay={450}>
                <Tooltip.Trigger role="presentation" tabIndex={-1}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="git-sync-button"
                    isPending={pending === 'fetch'}
                    isDisabled={!remote || Boolean(pending)}
                    onPress={() => void run('fetch')}
                  >
                    {pending === 'fetch' ? (
                      <Spinner size="sm" color="current" aria-hidden="true" role="presentation" />
                    ) : (
                      <CloudDownload />
                    )}
                    {t(pending === 'fetch' ? 'source.fetching' : 'source.fetch')}
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>
                  {lastFetch
                    ? t('source.lastFetch', { time: lastFetch })
                    : !remote
                      ? t('source.noRemote')
                      : t('source.neverFetched')}
                </Tooltip.Content>
              </Tooltip>
              <Tooltip delay={450}>
                <Tooltip.Trigger role="presentation" tabIndex={-1}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="git-sync-button"
                    isPending={pending === 'pull'}
                    isDisabled={Boolean(pending) || !state}
                    onPress={async () => {
                      setError('')
                      const next = await refresh()
                      if (next) {
                        setMode('ffOnly')
                        setPull(next)
                      }
                    }}
                  >
                    {pending === 'pull' ? (
                      <Spinner size="sm" color="current" aria-hidden="true" role="presentation" />
                    ) : (
                      <ArrowDownToLine />
                    )}
                    {t(pending === 'pull' ? 'source.pulling' : 'source.pull')}
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>
                  {blocked
                    ? pullBlockedReason
                    : t('source.pullDescription', {
                        branch: state!.branch.current!,
                        upstream: state!.upstream!,
                      })}
                </Tooltip.Content>
              </Tooltip>
            </div>
          </Toolbar>
        </div>
      </header>
      {operation || state?.conflicts.length || error || notice ? (
        <div
          className="git-sync-banner"
          data-warning={Boolean(operation || state?.conflicts.length || error)}
        >
          {operation || state?.conflicts.length || error ? <TriangleAlert /> : <Check />}
          <div className="git-sync-message" role={error ? 'alert' : 'status'}>
            {operation ? (
              <>
                <strong>
                  {t(operation === 'merge' ? 'source.mergeActive' : 'source.rebaseActive')}
                </strong>
                <small>
                  {state?.conflicts.length
                    ? t('source.conflictCount', { count: state.conflicts.length })
                    : t('source.operationReady')}
                </small>
              </>
            ) : (
              <span>
                {state?.conflicts.length
                  ? t('source.conflictCount', { count: state.conflicts.length })
                  : error || notice}
              </span>
            )}
          </div>
          {operation || state?.conflicts.length ? (
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setEditing(null)
                setRecovery(true)
              }}
            >
              {t('source.resolveConflicts')}
            </Button>
          ) : null}
          <SourceAction
            label={t('source.syncRetry')}
            onPress={() => {
              setError('')
              void refresh()
            }}
            isDisabled={Boolean(pending)}
          >
            <RefreshCw />
          </SourceAction>
          {!operation && !state?.conflicts.length && (
            <SourceAction
              label={t('common.close')}
              onPress={() => {
                setError('')
                setNotice('')
              }}
            >
              <X />
            </SourceAction>
          )}
        </div>
      ) : null}
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
                  <HoverScrollArea
                    className="git-conflict-list"
                    label={t('source.resolveConflicts')}
                  >
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
      {children && (
        <div
          className="git-sync-content"
          inert={Boolean(pending && pending !== 'fetch')}
          aria-busy={Boolean(pending && pending !== 'fetch')}
        >
          {children}
        </div>
      )}
    </GitOperationContext.Provider>
  )
}

function ConflictEditor({
  projectPath,
  path,
  onSaved,
  onClose,
}: {
  projectPath: string
  path: string
  onSaved: () => void
  onClose: () => void
}) {
  const t = useT()
  const result = useSourceQuery(`conflict-editor:${projectPath}:${path}`, () =>
    readProjectFile(projectPath, path),
  )
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const file = result.data
  const editable = file && !file.binary && !file.truncated && file.size <= 256 * 1024
  async function save() {
    if (!file || !editable || busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      await gitConflictWrite(projectPath, path, file.text, draft ?? file.text)
      onSaved()
      onClose()
    } catch (caught) {
      setError(syncError(caught, t))
    } finally {
      setPending(false)
      busy.current = false
    }
  }
  return (
    <div className="git-conflict-editor">
      {result.loading ? (
        <p role="status">{t('source.loading')}</p>
      ) : editable ? (
        <textarea
          aria-label={t('source.resolutionText')}
          spellCheck={false}
          value={draft ?? file.text}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <p>{result.error || t('source.conflictExternal')}</p>
      )}
      {error && (
        <p className="git-branch-error" role="alert">
          {error}
        </p>
      )}
      <div className="git-conflict-editor-actions">
        <Button variant="ghost" isDisabled={pending} onPress={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          isDisabled={!editable}
          isPending={pending}
          onPress={() => void save()}
        >
          {t('source.saveResolution')}
        </Button>
      </div>
    </div>
  )
}
