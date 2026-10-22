import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitCommitFiles } from '../../lib/source/api'
import type { GitCommit } from '../../lib/source/types'
import { HoverScrollArea } from '../HoverScrollArea'
import { DiffSkeleton } from './DiffSkeleton'
import { FilePathTree } from './FilePathTree'
import { HistoryList } from './HistoryList'
import { LoadedDiff } from './LoadedDiff'
import { SourceBrowser } from './SourceBrowser'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'

export function HistoryDetail({
  projectPath,
  tick,
  revision,
  commits,
  historyPath,
  onCommit,
}: {
  projectPath: string
  tick: number
  revision: string
  commits: GitCommit[]
  historyPath: string | null
  onCommit: (hash: string) => void
}) {
  const t = useT()
  const detail = useSourceQuery(
    `commit:${projectPath}:${revision}`,
    () => gitCommitFiles(projectPath, revision),
    tick,
  )
  const [choices, setChoices] = useState<Record<string, string>>({})
  const files = detail.data?.files ?? []
  const requested = choices[revision] ?? historyPath
  const selected = files.find((file) => file.path === requested)?.path ?? files[0]?.path ?? null
  return (
    <SourceBrowser
      history
      navigation={
        <>
          <HistoryList commits={commits} selected={revision} onSelect={onCommit} />
          <div className="source-commit-files">
            <div className="source-nav-heading">
              <span>{t('source.changedFiles')}</span>
              <code>{revision.slice(0, 7)}</code>
            </div>
            <HoverScrollArea
              shadowSize={0}
              className="source-tree-scroll"
              label={t('source.changedFiles')}
            >
              {detail.loading ? (
                <SourceNotice kind="loading" text={t('source.loading')} />
              ) : detail.error ? (
                <SourceNotice kind="error" text={detail.error} />
              ) : detail.data && !detail.data.available ? (
                <SourceNotice kind="empty" text={t('source.gitMissing')} />
              ) : (
                <FilePathTree
                  files={files}
                  selected={selected}
                  onSelect={(path) => setChoices((current) => ({ ...current, [revision]: path }))}
                />
              )}
            </HoverScrollArea>
          </div>
        </>
      }
    >
      {detail.loading ? (
        <DiffSkeleton />
      ) : selected ? (
        <LoadedDiff projectPath={projectPath} path={selected} revision={revision} tick={tick} />
      ) : (
        <SourceNotice
          kind={detail.error ? 'error' : 'empty'}
          text={detail.error || t('source.missingDiff')}
        />
      )}
    </SourceBrowser>
  )
}
