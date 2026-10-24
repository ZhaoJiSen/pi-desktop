import { Button } from '@heroui/react'
import { ArrowUp } from 'lucide-react'
import { SourceAction } from './SourceAction'
import type { useGitHistoryLog } from './useGitHistoryLog'

export function GitHistoryFooter({
  offset,
  t,
  commits,
  filtering,
  filtered,
  onLatest,
  hasNext,
  error,
  pending,
  loadMore,
  scrolled,
  scroller,
  locateError,
}: Pick<
  ReturnType<typeof useGitHistoryLog>,
  | 'offset'
  | 't'
  | 'commits'
  | 'filtering'
  | 'filtered'
  | 'hasNext'
  | 'error'
  | 'pending'
  | 'loadMore'
  | 'scrolled'
  | 'scroller'
> & {
  onLatest: () => void
  locateError: string
}) {
  return (
    <div className="git-log-status">
      <span className="git-log-count" aria-live="polite">
        {offset > 0
          ? t('source.loadedCommitWindow', {
              start: offset + 1,
              end: offset + commits.length,
            })
          : t('source.loadedCommitCount', { count: commits.length })}
        {filtering && (
          <>
            <span className="git-log-count-divider" aria-hidden="true">
              ·
            </span>
            {t('source.matchingCommitCount', { count: filtered.length })}
          </>
        )}
      </span>
      <div className="git-log-pagination-actions">
        {offset > 0 && (
          <Button size="sm" variant="ghost" onPress={onLatest}>
            {t('source.latestCommits')}
          </Button>
        )}
        {hasNext ? (
          <>
            {!filtering && !error && !pending && (
              <span className="git-log-auto-hint">{t('source.scrollForMore')}</span>
            )}
            <Button size="sm" variant="ghost" isPending={pending} onPress={() => void loadMore()}>
              {t(error ? 'source.retryLoad' : 'source.loadMore')}
            </Button>
          </>
        ) : (
          commits.length > 0 && (
            <span>{t(offset > 0 ? 'source.oldestCommitLoaded' : 'source.allHistoryLoaded')}</span>
          )
        )}
        {scrolled && (
          <SourceAction
            label={t('source.backToTop')}
            onPress={() => scroller.current?.scrollTo({ top: 0 })}
          >
            <ArrowUp />
          </SourceAction>
        )}
      </div>
      {(error || locateError) && (
        <p className="git-log-page-error" role="alert">
          {error || locateError}
        </p>
      )}
    </div>
  )
}
