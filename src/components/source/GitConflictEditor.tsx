import { Button } from '@heroui/react'
import { useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitConflictWrite, readProjectFile } from '../../lib/source/api'
import { syncError } from '../../lib/source/sync'
import { useSourceQuery } from './useSourceQuery'

export function ConflictEditor({
  projectPath,
  path,
  onSaved,
  onClose,
}: {
  projectPath: string
  path: string
  onSaved: () => void
  onClose: () => void
}) {
  const t = useT()
  const result = useSourceQuery(`conflict-editor:${projectPath}:${path}`, () =>
    readProjectFile(projectPath, path),
  )
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const file = result.data
  const editable = file && !file.binary && !file.truncated && file.size <= 256 * 1024
  async function save() {
    if (!file || !editable || busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      await gitConflictWrite(projectPath, path, file.text, draft ?? file.text)
      onSaved()
      onClose()
    } catch (caught) {
      setError(syncError(caught, t))
    } finally {
      setPending(false)
      busy.current = false
    }
  }
  return (
    <div className="git-conflict-editor">
      {result.loading ? (
        <p role="status">{t('source.loading')}</p>
      ) : editable ? (
        <textarea
          aria-label={t('source.resolutionText')}
          spellCheck={false}
          value={draft ?? file.text}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <p>{result.error || t('source.conflictExternal')}</p>
      )}
      {error && (
        <p className="git-branch-error" role="alert">
          {error}
        </p>
      )}
      <div className="git-conflict-editor-actions">
        <Button variant="ghost" isDisabled={pending} onPress={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          isDisabled={!editable}
          isPending={pending}
          onPress={() => void save()}
        >
          {t('source.saveResolution')}
        </Button>
      </div>
    </div>
  )
}
