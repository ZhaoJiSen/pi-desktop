import { OverflowTooltip } from '../OverflowTooltip'
import { Button, SearchField } from '@heroui/react'
import { useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import { connectVisible, layoutGraph } from '../../lib/source/graph'
import type { GitCommit } from '../../lib/source/types'
import { useWorkspace } from '../../store/workspace'
import { HistoryGraph } from './HistoryGraph'
import { historyRowHeight, useVirtualWindow } from './useVirtualWindow'

function formatWhen(timestamp: number, language: string) {
  return new Intl.DateTimeFormat(language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp * 1000)
}

export function HistoryList({
  commits,
  selected,
  onSelect,
}: {
  commits: GitCommit[]
  selected: string | null
  onSelect: (hash: string) => void
}) {
  const t = useT()
  const language = useWorkspace((state) => state.language)
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? commits.filter((commit) =>
          `${commit.subject} ${commit.author} ${commit.hash} ${commit.refs}`
            .toLowerCase()
            .includes(needle),
        )
      : commits
    return connectVisible(matched, new Set(matched.map((commit) => commit.hash)))
  }, [commits, query])
  const rows = useMemo(() => layoutGraph(visible), [visible])
  const { scroller, scrollTo, start, end, paddingTop, paddingBottom } = useVirtualWindow(
    visible.length,
    historyRowHeight,
  )
  return (
    <div className="history-list">
      <SearchField
        className="source-history-search"
        variant="secondary"
        value={query}
        onChange={(value) => {
          setQuery(value)
          scrollTo(0)
        }}
        aria-label={t('source.filterCommits')}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t('source.filterCommits')} />
        </SearchField.Group>
      </SearchField>
      <div className="source-scroll" role="list" ref={scroller}>
        {visible.length === 0 && <p className="source-note">{t('source.emptyFilter')}</p>}
        <div className="source-vpad" style={{ height: paddingTop }} />
        {visible.slice(start, end).map((commit, offset) => {
          const index = start + offset
          const row = rows[index]
          return (
            <Button
              key={commit.hash}
              variant="ghost"
              className="source-row history-row source-vrow"
              style={{ height: historyRowHeight }}
              aria-pressed={selected === commit.hash}
              onPress={() => onSelect(commit.hash)}
            >
              {row && <HistoryGraph row={row} />}
              <span className="history-copy">
                <OverflowTooltip className="source-name" text={commit.subject} />
                <OverflowTooltip
                  className="source-subpath"
                  text={`${commit.author} · ${formatWhen(commit.timestamp, language)}${commit.refs ? ` · ${commit.refs}` : ''}`}
                />
              </span>
            </Button>
          )
        })}
        <div className="source-vpad" style={{ height: paddingBottom }} />
      </div>
    </div>
  )
}
