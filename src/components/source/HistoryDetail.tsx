import { Button } from '@heroui/react'
import { useT } from '../../lib/i18n'
import { gitCommitFiles } from '../../lib/source/api'
import { fileNameOf } from '../../lib/source/paths'
import { LoadedDiff } from './LoadedDiff'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'

export function HistoryDetail({
  projectPath,
  tick,
  revision,
  file,
  onFile,
  onBack,
}: {
  projectPath: string
  tick: number
  revision: string
  file: string | null
  onFile: (path: string) => void
  onBack: () => void
}) {
  const t = useT()
  const detail = useSourceQuery(`commit:${projectPath}:${revision}:${tick}`, () =>
    gitCommitFiles(projectPath, revision),
  )
  if (file) {
    return (
      <LoadedDiff
        projectPath={projectPath}
        path={file}
        revision={revision}
        tick={tick}
        onBack={onBack}
      />
    )
  }
  return (
    <div className="history-detail">
      <p className="source-branch">{t('source.changedFiles')}</p>
      {detail.loading && <SourceNotice kind="loading" text={t('source.loading')} />}
      {detail.error && <SourceNotice kind="error" text={detail.error} />}
      {detail.data && detail.data.files.length === 0 && (
        <SourceNotice kind="empty" text={t('source.missingDiff')} />
      )}
      <div className="source-scroll" role="list">
        {detail.data?.files.map((item) => (
          <Button
            key={`${item.code}:${item.path}`}
            variant="ghost"
            className="source-row"
            onPress={() => onFile(item.path)}
          >
            <span className="source-code" data-code={item.code}>
              {item.code}
            </span>
            <span className="source-name">{fileNameOf(item.path)}</span>
            <span className="source-subpath">{item.path}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
