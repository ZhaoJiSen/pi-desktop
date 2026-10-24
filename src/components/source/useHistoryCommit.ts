import { useEffect, useState } from 'react'
import { gitCommitFiles } from '../../lib/source/api'
import { useSourceQuery } from './useSourceQuery'

export function useHistoryCommit({
  commit,
  projectPath,
  tick,
  historyPath,
  onShowDiff,
}: {
  commit: import('../../lib/source/types').GitCommit
  projectPath: string
  tick: number
  historyPath: string | null
  onShowDiff: () => void
}) {
  const detail = useSourceQuery(
    commit ? `workspace-commit:${projectPath}:${commit.hash}` : null,
    () => gitCommitFiles(projectPath, commit!.hash),
    tick,
  )
  const files = detail.data?.files ?? []
  const [choices, setChoices] = useState<Record<string, string>>({})
  const selectedFile =
    files.find((file) => file.path === (choices[commit?.hash ?? ''] ?? historyPath))?.path ??
    files[0]?.path ??
    null
  const [quickFind, setQuickFind] = useState(false)
  function chooseFile(path: string) {
    onShowDiff()
    if (commit) setChoices((current) => ({ ...current, [commit.hash]: path }))
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setQuickFind(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return { detail, files, selectedFile, quickFind, setQuickFind, chooseFile }
}
