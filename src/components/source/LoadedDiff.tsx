import { gitFileDiff } from '../../lib/source/api'
import { memo } from 'react'
import type { DiffLine } from '../../types'
import type { GitDiff } from '../../lib/source/types'
import { useT } from '../../lib/i18n'
import { FileDiff } from './FileDiff'
import { DiffSkeleton } from './DiffSkeleton'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'

export const LoadedDiff = memo(function LoadedDiff({
  projectPath,
  path,
  revision,
  tick,
  fallback,
  embedded,
  layout,
  onBack,
  load,
  onStats,
}: {
  projectPath: string
  path: string
  revision?: string | null
  tick: number | string
  fallback?: DiffLine[]
  embedded?: boolean
  layout?: 'unified' | 'split'
  onBack?: () => void
  load?: () => Promise<GitDiff>
  onStats?: (path: string, stats: { additions: number; deletions: number } | null) => void
}) {
  const t = useT()
  const diff = useSourceQuery(
    `diff:${projectPath}:${revision ?? ''}:${path}`,
    load ?? (() => gitFileDiff(projectPath, path, revision)),
    tick,
  )
  if (diff.loading) return <DiffSkeleton layout={layout} />
  if (diff.error || !diff.data) {
    return <SourceNotice kind="error" text={diff.error || t('source.missingDiff')} />
  }
  if (!diff.data.available) return <SourceNotice kind="empty" text={t('source.gitMissing')} />
  return (
    <FileDiff
      path={path}
      text={diff.data.text}
      binary={diff.data.binary}
      truncated={diff.data.truncated}
      missing={diff.data.missing}
      fallback={fallback}
      embedded={embedded}
      layout={layout}
      onBack={onBack}
      onStats={onStats}
    />
  )
})
