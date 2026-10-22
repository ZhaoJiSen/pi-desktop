import { useMemo, useState } from 'react'
import { HoverScrollArea } from '../HoverScrollArea'
import { useT } from '../../lib/i18n'
import { gitStatus } from '../../lib/source/api'
import { useSource } from './context'
import { FileTree } from './FileTree'
import { FileViewer } from './FileViewer'
import { LoadedDiff } from './LoadedDiff'
import { SourceBrowser } from './SourceBrowser'
import { SourceNotice } from './SourceNotice'
import { useProjectSource } from './useProjectSource'
import { useSourceQuery } from './useSourceQuery'

export function FilesPane({
  tick,
  requestNonce,
  initialPath,
  initialDiff,
  onHistory,
}: {
  tick: number
  requestNonce: number
  initialPath: string | null
  initialDiff: boolean
  onHistory: (path: string) => void
}) {
  const t = useT()
  const source = useSource()
  const { path: projectPath, revision, agent } = useProjectSource()
  const directory = initialPath?.endsWith('/') ? initialPath.replace(/\/+$/, '') : null
  const [selected, setSelected] = useState<string | null>(directory ? null : initialPath)
  const [mode, setMode] = useState<'view' | 'diff'>(initialDiff ? 'diff' : 'view')
  const [handledRequest, setHandledRequest] = useState(requestNonce)
  if (handledRequest !== requestNonce) {
    setHandledRequest(requestNonce)
    setSelected(directory ? null : initialPath)
    setMode(initialDiff && !directory ? 'diff' : 'view')
  }
  const status = useSourceQuery(
    projectPath ? `files-status:${projectPath}` : null,
    () => gitStatus(projectPath),
    `${revision}:${tick}`,
  )
  const marks = useMemo(
    () => new Map((status.data?.files ?? []).map((file) => [file.path, file.code])),
    [status.data],
  )
  const expand = selected?.includes('/') ? selected.slice(0, selected.lastIndexOf('/')) : directory
  if (!projectPath) return <SourceNotice kind="empty" text={t('source.noProject')} />
  return (
    <SourceBrowser
      navigation={
        <>
          <div className="source-nav-heading">{t('source.allFiles')}</div>
          <HoverScrollArea shadowSize={0} className="source-files-scroll" label={t('source.files')}>
            <FileTree
              projectPath={projectPath}
              tick={tick}
              expand={expand}
              selected={selected}
              marks={marks}
              agent={agent}
              onOpen={(path) => {
                setSelected(path)
                setMode('view')
              }}
            />
          </HoverScrollArea>
        </>
      }
    >
      {selected ? (
        mode === 'diff' ? (
          <LoadedDiff projectPath={projectPath} path={selected} tick={tick} />
        ) : (
          <FileViewer
            projectPath={projectPath}
            path={selected}
            tick={tick}
            changed={marks.has(selected)}
            onDiff={() => source?.show({ tab: 'changes', path: selected, mode: 'diff' })}
            onHistory={() => onHistory(selected)}
          />
        )
      ) : (
        <SourceNotice kind="empty" text={t('source.selectFile')} />
      )}
    </SourceBrowser>
  )
}
