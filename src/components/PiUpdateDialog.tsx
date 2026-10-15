import { AlertDialog, Button, ProgressBar } from '@heroui/react'
import { Download } from 'lucide-react'
import { useRef, useState } from 'react'
import { isDesktop, useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { upgradePi, PiReconnectError, type PiUpdate, type PiUpdatePhase } from '../lib/piUpdates'
import type { PiEnvironment } from '../lib/onboarding'
import { errorText } from '../lib/utils'
import { navigateToPage } from '../router/navigation'

export function PiUpdateContent({
  update,
  onLater,
  onUpdated,
}: {
  update: PiUpdate
  onLater?: () => void
  onUpdated: (environment: PiEnvironment) => void
}) {
  const t = useT()
  const [phase, setPhase] = useState<PiUpdatePhase | null>(null)
  const [error, setError] = useState('')
  const [reconnectFailed, setReconnectFailed] = useState(false)
  const retryConnection = useRef<PiReconnectError['retryConnection'] | null>(null)
  const connection = useWorkspace((state) => state.connection)
  async function upgrade() {
    if (phase) return
    setError('')
    try {
      const environment = await (retryConnection.current
        ? retryConnection.current(setPhase)
        : upgradePi(update.executable, setPhase))
      onUpdated(environment)
    } catch (reason) {
      retryConnection.current = reason instanceof PiReconnectError ? reason.retryConnection : null
      setReconnectFailed(reason instanceof PiReconnectError)
      setError(errorText(reason))
    } finally {
      setPhase(null)
    }
  }
  return (
    <div className="pi-update-content" aria-busy={Boolean(phase)}>
      <p className="pi-update-versions">
        {t('piUpdate.versions', { current: update.currentVersion, latest: update.latestVersion })}
      </p>
      <p className="pi-update-description">{t('piUpdate.description')}</p>
      <p className="sr-only" role="status" aria-live="polite">
        {phase && t(phase === 'reconnecting' ? 'piUpdate.reconnecting' : 'piUpdate.updating')}
      </p>
      {phase && (
        <ProgressBar
          className="pi-update-progress"
          aria-label={t(phase === 'reconnecting' ? 'piUpdate.reconnecting' : 'piUpdate.updating')}
          isIndeterminate
          size="sm"
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      )}
      {error && (
        <div className="pi-update-error" role="alert">
          <p>{error}</p>
          {!reconnectFailed && <p>{t('piUpdate.manualHelp')}</p>}
          {!reconnectFailed && (
            <a
              href="https://pi.dev/docs/latest/cli#update-pi-or-packages"
              target="_blank"
              rel="noreferrer"
            >
              {t('piUpdate.instructions')} ↗
            </a>
          )}
        </div>
      )}
      <div className="pi-update-actions">
        {error && onLater && connection === 'error' && (
          <Button
            variant="ghost"
            isDisabled={Boolean(phase)}
            onPress={() => {
              onLater?.()
              void navigateToPage('settings')
            }}
          >
            {t('piUpdate.settings')}
          </Button>
        )}
        {onLater && (
          <Button variant="secondary" isDisabled={Boolean(phase)} onPress={onLater}>
            {t('piUpdate.later')}
          </Button>
        )}
        <Button isPending={Boolean(phase)} onPress={() => void upgrade()}>
          {t(
            phase
              ? phase === 'reconnecting'
                ? 'piUpdate.reconnecting'
                : 'piUpdate.updating'
              : reconnectFailed
                ? 'piUpdate.retryConnection'
                : error
                  ? 'piUpdate.retry'
                  : 'piUpdate.now',
          )}
        </Button>
      </div>
    </div>
  )
}

export function PiUpdateDialog({ update, onClose }: { update: PiUpdate; onClose: () => void }) {
  const t = useT()
  const updating = useWorkspace((state) => state.piUpdating)
  return (
    <AlertDialog.Backdrop
      isOpen
      isDismissable={false}
      isKeyboardDismissDisabled={updating}
      onOpenChange={(open) => {
        if (!open && !updating) onClose()
      }}
      className="dialog-backdrop"
    >
      <AlertDialog.Container size="sm">
        {isDesktop && (
          <div className="pi-update-drag-region" data-tauri-drag-region aria-hidden="true" />
        )}
        <AlertDialog.Dialog className="pi-update-dialog" data-pi-update-dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="accent">
              <Download aria-hidden="true" />
            </AlertDialog.Icon>
            <AlertDialog.Heading>{t('piUpdate.title')}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <PiUpdateContent update={update} onLater={onClose} onUpdated={onClose} />
          </AlertDialog.Body>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
