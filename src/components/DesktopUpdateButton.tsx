import { Button, Popover, ProgressCircle, Tooltip } from '@heroui/react'
import { ArrowDownToLine, ArrowRight, RotateCw } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useDesktopUpdate } from '../hooks/useDesktopUpdate'
import { useT } from '../lib/i18n'
import { useWorkspace } from '../store/workspace'

const DesktopReleaseNotes = lazy(() => import('./DesktopReleaseNotes'))

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB']
  const unit = Math.min(3, Math.floor(Math.log10(Math.max(1, bytes)) / 3))
  const value = bytes / 1000 ** unit
  return `${Number(value.toFixed(1))} ${units[unit]}`
}

export function DesktopUpdateButton() {
  const { status, error, pending, act } = useDesktopUpdate()
  const [open, setOpen] = useState(false)
  const busy = useWorkspace(
    (state) =>
      Boolean(state.runningSessionId) ||
      state.piBusyRuns.length > 0 ||
      state.piUpdating ||
      state.connection === 'connecting',
  )
  const t = useT()
  if (!status?.version) return null
  const downloading = status.phase === 'downloading'
  const ready = status.phase === 'ready' || status.phase === 'installing'
  const installing = status.phase === 'installing'
  const working = downloading || installing || pending
  const title = t(
    installing ? 'appUpdate.installing' : ready ? 'appUpdate.ready' : 'appUpdate.title',
  )
  const progress = status.total
    ? Math.min(100, Math.floor((status.downloaded / status.total) * 100))
    : undefined
  const downloadLabel = t(progress === 100 ? 'appUpdate.verifying' : 'appUpdate.downloading')
  const transferSize = `${formatBytes(status.downloaded)}${status.total ? ` / ${formatBytes(status.total)}` : ''}`
  const transferLabel =
    progress !== undefined && progress < 100 ? t('appUpdate.progress', { progress }) : downloadLabel
  const label = installing
    ? t('appUpdate.installing')
    : t(ready ? 'appUpdate.readyLabel' : 'appUpdate.availableLabel', {
        version: status.version,
      })
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Tooltip delay={450} isDisabled={open}>
        <Tooltip.Trigger
          className="desktop-update-entry"
          role="presentation"
          tabIndex={-1}
          data-tauri-drag-region="false"
        >
          <Button
            isIconOnly
            variant="ghost"
            className="icon-button desktop-update-trigger"
            data-tauri-drag-region="false"
            data-ready={ready || undefined}
            aria-label={label}
          >
            {ready ? <RotateCw aria-hidden="true" /> : <ArrowDownToLine aria-hidden="true" />}
            {!downloading && <span className="desktop-update-dot" aria-hidden="true" />}
          </Button>
          {downloading && (
            <ProgressCircle
              className="desktop-update-ring"
              value={progress}
              isIndeterminate={progress === undefined || progress === 100}
              aria-label={downloadLabel}
              aria-valuetext={`${transferLabel}, ${transferSize}`}
            >
              <ProgressCircle.Track>
                <ProgressCircle.TrackCircle strokeWidth={2} />
                <ProgressCircle.FillCircle strokeWidth={2} />
              </ProgressCircle.Track>
            </ProgressCircle>
          )}
        </Tooltip.Trigger>
        <Tooltip.Content placement="bottom end">
          {downloading ? `${transferLabel} · ${transferSize}` : label}
        </Tooltip.Content>
      </Tooltip>
      <Popover.Content className="desktop-update-popover" placement="bottom end" offset={10}>
        <Popover.Dialog aria-label={title}>
          <div className="desktop-update-heading">
            <div>
              <Popover.Heading>{title}</Popover.Heading>
              <p className="desktop-update-versions">
                <span>{status.currentVersion}</span>
                <ArrowRight aria-hidden="true" />
                <strong>{status.version}</strong>
              </p>
            </div>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {installing
              ? t('appUpdate.installing')
              : ready
                ? t('appUpdate.ready')
                : downloading
                  ? t('appUpdate.downloading')
                  : ''}
          </p>
          {status.notes?.trim() && (
            <Suspense fallback={null}>
              <DesktopReleaseNotes notes={status.notes.trim()} />
            </Suspense>
          )}
          {error && (
            <p className="desktop-update-error" role="alert">
              {error}
            </p>
          )}
          {ready && busy && <p className="desktop-update-description">{t('appUpdate.busy')}</p>}
          <div className="desktop-update-actions">
            {downloading && (
              <span className="desktop-update-transfer" title={transferSize}>
                {transferLabel}
              </span>
            )}
            <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
              {t(downloading || installing ? 'appUpdate.collapse' : 'appUpdate.later')}
            </Button>
            {!downloading && (
              <Button
                size="sm"
                className="desktop-update-primary"
                isPending={working}
                isDisabled={working || (ready && busy)}
                onPress={() => void act()}
              >
                {t(
                  installing
                    ? 'appUpdate.installing'
                    : ready
                      ? 'appUpdate.restart'
                      : error
                        ? 'appUpdate.retry'
                        : 'appUpdate.download',
                )}
              </Button>
            )}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
