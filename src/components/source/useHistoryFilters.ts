import { useMemo, useState } from 'react'
import { commitLabel } from '../../lib/source/historyLabels'

export function useHistoryFilters({
  commits,
  location,
  query,
}: {
  commits: import('../../lib/source/types').GitCommit[]
  location: import('../../lib/source/types').GitHeadLocation | null
  query: string
}) {
  const [kind, setKind] = useState('all')
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const commit of commits) {
      const key = commitLabel(commit.subject).kind
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [commits])
  const [author, setAuthor] = useState('')
  const [period, setPeriod] = useState(0)
  const [choice, setChoice] = useState<string | null>(location?.head ?? null)
  const authors = useMemo(
    () => [...new Set(commits.map((commit) => commit.author))].sort(),
    [commits],
  )
  const filtered = useMemo(
    () => filterCommits(commits, query, kind, author, period),
    [author, commits, kind, period, query],
  )
  return {
    kind,
    setKind,
    kindCounts,
    author,
    setAuthor,
    period,
    setPeriod,
    choice,
    setChoice,
    authors,
    filtered,
  }
}

function filterCommits(
  commits: import('../../lib/source/types').GitCommit[],
  query: string,
  kind: string,
  author: string,
  period: number,
) {
  const needle = query.trim().toLowerCase()
  const after = period ? Date.now() / 1000 - period * 86400 : 0
  return commits.filter(
    (commit) =>
      (kind === 'all' || commitLabel(commit.subject).kind === kind) &&
      (!author || commit.author === author) &&
      commit.timestamp >= after &&
      (!needle ||
        `${commit.subject} ${commit.hash} ${commit.author} ${commit.refs}`
          .toLowerCase()
          .includes(needle)),
  )
}
