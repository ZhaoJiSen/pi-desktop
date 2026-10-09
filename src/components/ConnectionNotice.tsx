import { Button } from '@heroui/react'
import { RotateCw, TriangleAlert, X } from 'lucide-react'
import { connectSession } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { isDesktop, useWorkspace } from '../store/workspace'

export function ConnectionNotice({ utility = false }: { utility?: boolean }) {
  const error = useWorkspace((state) => state.connectionError)
  const storageError = useWorkspace((state) => state.storageError)
  const active = useWorkspace((state) => state.activeSessionId)
  const running = useWorkspace((state) => state.runningSessionId)
  const connection = useWorkspace((state) => state.connection)
  const t = useT()
  if (!error && !storageError) return null
  return (
    <div className={`connection-notice${utility ? ' utility-notice' : ''}`} role="alert">
      <TriangleAlert />
      <span>{storageError || error}</span>
      {isDesktop && active && !running && (
        <Button
          variant="ghost"
          className="notice-action"
          isDisabled={connection === 'connecting'}
          onPress={() => void connectSession(active, true)}
        >
          <RotateCw />
          {t('connection.reconnect')}
        </Button>
      )}
      {!utility && (
        <Button
          isIconOnly
          variant="ghost"
          className="icon-button"
          aria-label={t('common.close')}
          onPress={() => useWorkspace.setState({ connectionError: null })}
        >
          <X />
        </Button>
      )}
    </div>
  )
}
