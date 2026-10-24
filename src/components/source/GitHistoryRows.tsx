import { Chip } from '@heroui/react'
import { HoverScrollArea } from '../HoverScrollArea'
import { OverflowTooltip } from '../OverflowTooltip'
import { HistoryGraph } from './HistoryGraph'
import { HistoryHash } from './HistoryHash'
import { HistoryReferences } from './HistoryReferences'
import { HistorySubject } from './HistorySubject'
import { SourceNotice } from './SourceNotice'
import type { useGitHistoryLog } from './useGitHistoryLog'

export function GitHistoryRows({
  scroller,
  t,
  filtered,
  commits,
  virtual,
  commit,
  head,
  setChoice,
  graph,
  formatDate,
}: Pick<
  ReturnType<typeof useGitHistoryLog>,
  | 'scroller'
  | 't'
  | 'filtered'
  | 'commits'
  | 'virtual'
  | 'commit'
  | 'setChoice'
  | 'graph'
  | 'formatDate'
> & {
  head: string | null
}) {
  return (
    <HoverScrollArea
      className="git-log-scroll"
      viewportClassName="git-log-viewport"
      viewportRef={scroller}
      label={t('source.history')}
      shadowSize={18}
    >
      <div className="git-log-rows" role="listbox" aria-label={t('source.history')}>
        {!filtered.length && (
          <SourceNotice
            kind="empty"
            text={commits.length ? t('source.emptyFilter') : t('source.emptyHistory')}
          />
        )}
        <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
          {virtual.getVirtualItems().map((row) => {
            const item = filtered[row.index]!
            return (
              <div
                key={item.hash}
                role="option"
                aria-selected={item.hash === commit?.hash}
                className="git-log-row"
                data-current={item.hash === head || undefined}
                aria-current={item.hash === head ? 'location' : undefined}
                style={{
                  position: 'absolute',
                  top: row.start,
                  height: row.size,
                  width: '100%',
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setChoice(item.hash)
                    return
                  }
                  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
                  event.preventDefault()
                  const index =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? filtered.length - 1
                        : Math.max(
                            0,
                            Math.min(
                              filtered.length - 1,
                              row.index + (event.key === 'ArrowDown' ? 1 : -1),
                            ),
                          )
                  setChoice(filtered[index]!.hash)
                  virtual.scrollToIndex(index)
                  requestAnimationFrame(() =>
                    scroller.current
                      ?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)
                      ?.focus(),
                  )
                }}
                tabIndex={item.hash === commit?.hash ? 0 : -1}
                data-row-index={row.index}
                onClick={() => setChoice(item.hash)}
              >
                <span className="git-log-subject">
                  <HistoryGraph row={graph[row.index]!} height={34} />
                  {item.hash === head && (
                    <Chip
                      size="sm"
                      variant="soft"
                      className="git-head-badge"
                      aria-label={t('source.currentCommit')}
                    >
                      HEAD
                    </Chip>
                  )}
                  <HistorySubject subject={item.subject} />
                  {item.refs && <HistoryReferences refs={item.refs} />}
                </span>
                <OverflowTooltip className="git-log-author" text={item.author} />
                <time dateTime={new Date(item.timestamp * 1000).toISOString()}>
                  {formatDate.format(item.timestamp * 1000)}
                </time>
                <HistoryHash hash={item.hash} />
              </div>
            )
          })}
        </div>
      </div>
    </HoverScrollArea>
  )
}
