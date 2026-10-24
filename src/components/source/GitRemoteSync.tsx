import { type ReactNode } from 'react'
import { GitOperationContext } from './GitOperationContext'
import { GitPullDialog } from './GitPullDialog'
import { GitRecoveryDialog } from './GitRecoveryDialog'
import { GitSyncBanner } from './GitSyncBanner'
import { GitSyncToolbar } from './GitSyncToolbar'
import { useGitRemoteSync } from './useGitRemoteSync'

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
  const {
    t,
    state,
    error,
    setError,
    notice,
    setNotice,
    pending,
    pull,
    setPull,
    mode,
    setMode,
    recovery,
    setRecovery,
    confirm,
    setConfirm,
    editing,
    setEditing,
    refresh,
    run,
    remote,
    operation,
    operationName,
    lastFetch,
    blocked,
    pullBlockedReason,
  } = useGitRemoteSync({ projectPath, tick, onChanged, onFetched })

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
          <GitSyncToolbar
            t={t}

            pending={pending}
            repository={repository}
            state={state}
            remote={remote}
            run={run}
            lastFetch={lastFetch}
            setError={setError}
            refresh={refresh}
            setMode={setMode}
            setPull={setPull}
            blocked={blocked}
            pullBlockedReason={pullBlockedReason}
          />
        </div>
      </header>
      {operation || state?.conflicts.length || error || notice ? (
        <GitSyncBanner
          operation={operation}
          state={state}
          error={error}
          t={t}
          notice={notice}
          setEditing={setEditing}
          setRecovery={setRecovery}
          setError={setError}
          refresh={refresh}
          pending={pending}
          setNotice={setNotice}
        />
      ) : null}
      <GitPullDialog
        pull={pull}
        pending={pending}
        setPull={setPull}
        t={t}
        mode={mode}
        setMode={setMode}
        error={error}
        run={run}
      />
      <GitRecoveryDialog
        recovery={recovery}
        pending={pending}
        editing={editing}
        setRecovery={setRecovery}
        setConfirm={setConfirm}
        t={t}
        projectPath={projectPath}
        setNotice={setNotice}
        onChanged={onChanged}
        setEditing={setEditing}
        confirm={confirm}
        operationName={operationName}
        state={state}
        operation={operation}
        notice={notice}
        onShowChanges={onShowChanges}
        error={error}
        run={run}
      />
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
