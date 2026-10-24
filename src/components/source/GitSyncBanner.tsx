import { Button } from '@heroui/react'
import { Check, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { SourceAction } from './SourceAction'
import type { useGitRemoteSync } from './useGitRemoteSync'

export function GitSyncBanner({
  operation,
  state,
  error,
  t,
  notice,
  setEditing,
  setRecovery,
  setError,
  refresh,
  pending,
  setNotice,
}: Pick<
  ReturnType<typeof useGitRemoteSync>,
  | 'operation'
  | 'state'
  | 'error'
  | 't'
  | 'notice'
  | 'setEditing'
  | 'setRecovery'
  | 'setError'
  | 'refresh'
  | 'pending'
  | 'setNotice'
>) {
  return (
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
  )
}
