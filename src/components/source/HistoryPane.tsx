import { Button } from '@heroui/react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitLog } from '../../lib/source/api'
import { fileNameOf } from '../../lib/source/paths'
import { HistoryDetail } from './HistoryDetail'
import { HistoryList } from './HistoryList'
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
    projectPath ? `log:${projectPath}:${historyPath ?? ''}:${tick}` : null,
    () => gitLog(projectPath, historyPath),
  )
  const [commit, setCommit] = useState<string | null>(null)
  const [file, setFile] = useState<string | null>(null)
  if (!projectPath) return <SourceNotice kind="empty" text={t('source.noProject')} />
  if (log.loading) return <SourceNotice kind="loading" text={t('source.loading')} />
  if (log.error || !log.data) {
    return <SourceNotice kind="error" text={log.error || t('source.emptyHistory')} />
  }
  if (!log.data.repo) return <SourceNotice kind="empty" text={t('source.notRepository')} />
  if (!log.data.commits.length) return <SourceNotice kind="empty" text={t('source.emptyHistory')} />
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
      <HistoryList
        commits={log.data.commits}
        selected={commit}
        onSelect={(hash) => {
          setCommit(hash)
          setFile(null)
        }}
      />
      {commit && (
        <HistoryDetail
          projectPath={projectPath}
          tick={tick}
          revision={commit}
          file={file}
          onFile={setFile}
          onBack={() => setFile(null)}
        />
      )}
    </div>
  )
}
