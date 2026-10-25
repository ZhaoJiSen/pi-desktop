import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGitFetchInterval } from '../../hooks/useGitFetchInterval'
import { useT } from '../../lib/i18n'
import { reportSuccessNotice } from '../../lib/notices'
import { gitSyncAction, gitSyncState } from '../../lib/source/api'
import { syncError, syncRequest } from '../../lib/source/sync'
import type { GitPullMode, GitSyncAction, GitSyncState } from '../../lib/source/types'
import { useWorkspace } from '../../store/workspace'
import { useGitRepositoryStatus } from './GitRepositoryStatus'

export function useGitRemoteSync({
  projectPath,
  tick,
  onChanged,
  onFetched,
}: {
  projectPath: string
  tick: number
  onChanged: () => void
  onFetched: () => void
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
      if (live.current && id === sequence.current) {
        const old = latest.current.state
        setState(next)
        if (
          !busy.current &&
          old &&
          (old.branch.head !== next.branch.head ||
            old.branch.current !== next.branch.current ||
            old.branch.operation !== next.branch.operation)
        )
          latest.current.onChanged()
      }
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
          ? repositoryStatus?.status.data?.files.length === 0
            ? t('source.syncDirtyOutsideList')
            : t('source.syncDirty')
          : ''
  return {
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
  }
}
