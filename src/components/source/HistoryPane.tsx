import { Button } from '@heroui/react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitLog } from '../../lib/source/api'
import { fileNameOf } from '../../lib/source/paths'
import { HistoryDetail } from './HistoryDetail'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'

export function HistoryPane({
  projectPath,
  tick,
  historyPath,
  onClear,
}: {
  projectPath: string
  tick: number
  historyPath: string | null
  onClear: () => void
}) {
  const t = useT()
  const log = useSourceQuery(
    projectPath ? `log:${projectPath}:${historyPath ?? ''}` : null,
    () => gitLog(projectPath, historyPath),
    tick,
  )
  const [commit, setCommit] = useState<string | null>(null)
  const [trackedPath, setTrackedPath] = useState(historyPath)
  if (trackedPath !== historyPath) {
    setTrackedPath(historyPath)
    setCommit(null)
  }
  let notice: { kind: 'loading' | 'empty' | 'error'; text: string } | null = null
  if (!projectPath) notice = { kind: 'empty', text: t('source.noProject') }
  else if (log.loading) notice = { kind: 'loading', text: t('source.loading') }
  else if (log.error || !log.data)
    notice = { kind: 'error', text: log.error || t('source.emptyHistory') }
  else if (!log.data.available) notice = { kind: 'empty', text: t('source.gitMissing') }
  else if (!log.data.repo) notice = { kind: 'empty', text: t('source.notRepository') }
  else if (!log.data.commits.length) notice = { kind: 'empty', text: t('source.emptyHistory') }
  return (
    <div className="history-pane">
      {historyPath && (
        <div className="source-filter">
          <span>{t('source.historyForFile', { file: fileNameOf(historyPath) })}</span>
          <Button variant="ghost" className="source-back" onPress={onClear}>
            {t('source.allCommits')}
          </Button>
        </div>
      )}
      {notice ? (
        <SourceNotice kind={notice.kind} text={notice.text} />
      ) : (
        log.data && (
          <HistoryDetail
            projectPath={projectPath}
            tick={tick}
            revision={
              log.data.commits.find((item) => item.hash === commit)?.hash ??
              log.data.commits[0]!.hash
            }
            commits={log.data.commits}
            historyPath={historyPath}
            onCommit={setCommit}
          />
        )
      )}
    </div>
  )
}
