import { useState } from 'react'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import { removeSession } from '../../lib/desktop'
import { errorText } from '../../lib/utils'
import { RemoveConfirmationDialog } from '../RemoveConfirmationDialog'

export function RemoveSessionDialog({
  sessionId,
  onClose,
}: {
  sessionId: string
  onClose: () => void
}) {
  const session = useWorkspace((state) => state.sessions.find((item) => item.id === sessionId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = useT()
  async function remove() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await removeSession(sessionId)
      onClose()
    } catch (error) {
      setError(errorText(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <RemoveConfirmationDialog
      title={t('sessions.removeTitle')}
      name={session?.title || t('sessions.new')}
      description={t('sessions.removeDescription')}
      confirmLabel={t('sessions.remove')}
      pending={saving}
      error={error}
      onClose={onClose}
      onConfirm={() => void remove()}
    />
  )
}
