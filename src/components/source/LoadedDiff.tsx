import { gitFileDiff } from '../../lib/source/api'
import type { DiffLine } from '../../types'
import { useT } from '../../lib/i18n'
import { FileDiff } from './FileDiff'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'

export function LoadedDiff({
  projectPath,
  path,
  revision,
  tick,
  fallback,
  onBack,
}: {
  projectPath: string
  path: string
  revision?: string | null
  tick: number
  fallback?: DiffLine[]
  onBack?: () => void
}) {
  const t = useT()
  const diff = useSourceQuery(`diff:${projectPath}:${revision ?? ''}:${path}:${tick}`, () =>
    gitFileDiff(projectPath, path, revision),
  )
  if (diff.loading) return <SourceNotice kind="loading" text={t('source.loading')} />
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
      onBack={onBack}
    />
  )
}
