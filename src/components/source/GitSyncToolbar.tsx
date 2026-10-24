import { Button, Chip, Separator, Spinner, Toolbar, Tooltip } from '@heroui/react'
import { ArrowDown, ArrowDownToLine, ArrowUp, CloudDownload } from 'lucide-react'
import type * as React from 'react'
import type { useGitRemoteSync } from './useGitRemoteSync'

export function GitSyncToolbar({
  t,
  pending,
  repository,
  state,
  remote,
  run,
  lastFetch,
  setError,
  refresh,
  setMode,
  setPull,
  blocked,
  pullBlockedReason,
}: Pick<
  ReturnType<typeof useGitRemoteSync>,
  | 't'
  | 'pending'
  | 'state'
  | 'remote'
  | 'run'
  | 'lastFetch'
  | 'setError'
  | 'refresh'
  | 'setMode'
  | 'setPull'
  | 'blocked'
  | 'pullBlockedReason'
> & {
  repository: React.ReactNode
}) {
  return (
    <Toolbar className="git-workspace-tools" aria-label={t('source.repositoryActions')} isAttached>
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
      {state?.upstream && <Separator orientation="vertical" className="git-toolbar-divider" />}
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
  )
}
