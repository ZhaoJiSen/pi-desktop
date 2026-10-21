import { Button } from '@heroui/react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitStatus } from '../../lib/source/api'
import { fileNameOf, pathTouched } from '../../lib/source/paths'
import type { DiffLine } from '../../types'
import { useSource } from './context'
import { FileDiff } from './FileDiff'
import { LoadedDiff } from './LoadedDiff'
import { SourceNotice } from './SourceNotice'
import { useProjectSource } from './useProjectSource'
import { useSourceQuery } from './useSourceQuery'
import { changeRowHeight, useVirtualWindow } from './useVirtualWindow'

export function ChangesPane({
  tick,
  initialPath,
  fallback,
  fallbackLabel,
}: {
  tick: number
  initialPath: string | null
  fallback?: DiffLine[]
  fallbackLabel: string
}) {
  const t = useT()
  const source = useSource()
  const { path: projectPath, revision, agent } = useProjectSource()
  const [selected, setSelected] = useState<string | null>(initialPath)
  const [showFallback, setShowFallback] = useState(!initialPath && Boolean(fallback?.length))
  const status = useSourceQuery(
    projectPath ? `status:${projectPath}:${revision}:${tick}` : null,
    () => gitStatus(projectPath),
  )
  const files = status.data && status.data.repo ? status.data.files : []
  const { scroller, start, end, paddingTop, paddingBottom } = useVirtualWindow(
    files.length,
    changeRowHeight,
  )
  if (!projectPath) return <SourceNotice kind="empty" text={t('source.noProject')} />
  if (selected) {
    return (
      <LoadedDiff
        projectPath={projectPath}
        path={selected}
        tick={tick}
        fallback={selected === initialPath ? fallback : undefined}
        onBack={() => setSelected(null)}
      />
    )
  }
  if (showFallback && fallback?.length) {
    return (
      <FileDiff
        path={fallbackLabel || initialPath || 'diff'}
        text=""
        binary={false}
        truncated={false}
        missing
        fallback={fallback}
        onBack={() => setShowFallback(false)}
      />
    )
  }
  if (status.loading) return <SourceNotice kind="loading" text={t('source.loading')} />
  if (status.error || !status.data) {
    return <SourceNotice kind="error" text={status.error || t('source.missingDiff')} />
  }
  if (!status.data.available) return <SourceNotice kind="empty" text={t('source.gitMissing')} />
  if (!status.data.repo) return <SourceNotice kind="empty" text={t('source.notRepository')} />
  if (!status.data.files.length)
    return <SourceNotice kind="empty" text={t('source.emptyChanges')} />
  return (
    <div className="source-changes">
      {status.data.branch && <p className="source-branch">{status.data.branch}</p>}
      {status.data.truncated && <p className="source-note">{t('source.truncatedList')}</p>}
      <div className="source-scroll" role="list" ref={scroller}>
        <div className="source-vpad" style={{ height: paddingTop }} />
        {files.slice(start, end).map((file) => (
          <Button
            key={file.path}
            variant="ghost"
            className="source-row source-vrow"
            style={{ height: changeRowHeight }}
            onPress={() => {
              if (file.path.endsWith('/')) {
                source?.show({ tab: 'files', path: file.path, mode: 'view' })
                return
              }
              setSelected(file.path)
            }}
          >
            <span className="source-code" data-code={file.code}>
              {file.code}
            </span>
            <span className="source-name" title={file.path}>
              {fileNameOf(file.path)}
            </span>
            <span className="source-subpath">{file.path}</span>
            {pathTouched(agent, file.path) && (
              <span className="source-agent">{t('source.agent')}</span>
            )}
          </Button>
        ))}
        <div className="source-vpad" style={{ height: paddingBottom }} />
      </div>
    </div>
  )
}
