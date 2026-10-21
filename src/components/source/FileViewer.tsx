import { Button } from '@heroui/react'
import { useT } from '../../lib/i18n'
import { readProjectFile } from '../../lib/source/api'
import { fileNameOf } from '../../lib/source/paths'
import { fileLanguage, Highlight } from '../conversation/Highlight'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'

export function FileViewer({
  projectPath,
  path,
  tick,
  changed,
  onBack,
  onDiff,
  onHistory,
}: {
  projectPath: string
  path: string
  tick: number
  changed: boolean
  onBack: () => void
  onDiff: () => void
  onHistory: () => void
}) {
  const t = useT()
  const file = useSourceQuery(`file:${projectPath}:${path}:${tick}`, () =>
    readProjectFile(projectPath, path),
  )
  return (
    <div className="source-detail">
      <div className="source-detail-bar">
        <Button variant="ghost" className="source-back" onPress={onBack}>
          {t('source.back')}
        </Button>
        <span className="source-detail-path" title={path}>
          {path}
        </span>
        {changed && (
          <Button variant="ghost" className="source-back" onPress={onDiff}>
            {t('source.showDiff')}
          </Button>
        )}
        <Button variant="ghost" className="source-back" onPress={onHistory}>
          {t('source.fileHistory')}
        </Button>
      </div>
      {file.loading && <SourceNotice kind="loading" text={t('source.loading')} />}
      {file.error && <SourceNotice kind="error" text={file.error} />}
      {file.data?.binary && <SourceNotice kind="empty" text={t('source.binaryFile')} />}
      {file.data && !file.data.binary && (
        <>
          {file.data.truncated && <p className="source-note">{t('source.truncatedFile')}</p>}
          <div className="code source-file" tabIndex={0} aria-label={fileNameOf(path)}>
            {file.data.text.split('\n').map((line, index) => (
              <div className="code-line context" key={index}>
                <span className="line-no">{index + 1}</span>
                <code className="source">
                  <Highlight text={line} language={fileLanguage(path)} />
                </code>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
