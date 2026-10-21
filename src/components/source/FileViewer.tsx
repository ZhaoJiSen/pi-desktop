import { Button } from '@heroui/react'
import { useT } from '../../lib/i18n'
import { readProjectFile } from '../../lib/source/api'
import { fileNameOf } from '../../lib/source/paths'
import { fileLanguage, Highlight } from '../conversation/Highlight'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'
import { codeRowHeight, useVirtualWindow } from './useVirtualWindow'

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
  const lines = file.data && !file.data.binary ? file.data.text.split('\n') : []
  const { scroller, start, end, paddingTop, paddingBottom } = useVirtualWindow(
    lines.length,
    codeRowHeight,
  )
  const language = fileLanguage(path)
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
          <div
            className="code source-file"
            tabIndex={0}
            aria-label={fileNameOf(path)}
            ref={scroller}
          >
            <div className="source-vpad" style={{ height: paddingTop }} />
            {lines.slice(start, end).map((line, offset) => {
              const index = start + offset
              return (
                <div
                  className="code-line context source-vrow"
                  style={{ height: codeRowHeight }}
                  key={index}
                >
                  <span className="line-no">{index + 1}</span>
                  <code className="source">
                    <Highlight text={line} language={language} />
                  </code>
                </div>
              )
            })}
            <div className="source-vpad" style={{ height: paddingBottom }} />
          </div>
        </>
      )}
    </div>
  )
}
