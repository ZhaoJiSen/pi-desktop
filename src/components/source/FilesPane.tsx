import { useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitStatus } from '../../lib/source/api'
import { FileTree } from './FileTree'
import { FileViewer } from './FileViewer'
import { LoadedDiff } from './LoadedDiff'
import { SourceNotice } from './SourceNotice'
import { useProjectSource } from './useProjectSource'
import { useSourceQuery } from './useSourceQuery'

export function FilesPane({
  tick,
  initialPath,
  initialDiff,
  onHistory,
}: {
  tick: number
  initialPath: string | null
  initialDiff: boolean
  onHistory: (path: string) => void
}) {
  const t = useT()
  const { path: projectPath, revision, agent } = useProjectSource()
  const [selected, setSelected] = useState<string | null>(initialPath)
  const [mode, setMode] = useState<'view' | 'diff'>(initialDiff ? 'diff' : 'view')
  const status = useSourceQuery(
    projectPath ? `files-status:${projectPath}:${revision}:${tick}` : null,
    () => gitStatus(projectPath),
  )
  const marks = useMemo(() => {
    const map = new Map<string, string>()
    for (const file of status.data?.files ?? []) map.set(file.path, file.code)
    return map
  }, [status.data])
  if (!projectPath) return <SourceNotice kind="empty" text={t('source.noProject')} />
  if (selected && mode === 'diff') {
    return (
      <LoadedDiff
        projectPath={projectPath}
        path={selected}
        tick={tick}
        onBack={() => setMode('view')}
      />
    )
  }
  if (selected) {
    return (
      <FileViewer
        projectPath={projectPath}
        path={selected}
        tick={tick}
        changed={marks.has(selected)}
        onBack={() => setSelected(null)}
        onDiff={() => setMode('diff')}
        onHistory={() => onHistory(selected)}
      />
    )
  }
  return (
    <div className="source-scroll">
      {status.data && !status.data.available && (
        <p className="source-note">{t('source.gitMissing')}</p>
      )}
      <FileTree
        projectPath={projectPath}
        tick={tick}
        marks={marks}
        agent={agent}
        onOpen={(path) => {
          setSelected(path)
          setMode('view')
        }}
      />
    </div>
  )
}
