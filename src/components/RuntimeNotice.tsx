import { Toast, ToastQueue } from '@heroui/react'
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { onRuntimeNotice } from '../lib/desktop'
import { useT } from '../lib/i18n'
import type { MessageKey } from '../lib/locale'
import { actionNotice, onActionNotice } from '../lib/notices'
import { onPackageBatchNotice } from '../lib/packageBatch'

type Notice = { message: string; tone: 'info' | 'warning' | 'success' }

function causeText(detail: string) {
  const code = detail.match(/^(.*?)(\(os error \d+\))$/)
  if (!code) return detail
  return (
    <>
      {code[1]}
      <span className="runtime-notice-code">{code[2]}</span>
    </>
  )
}

export function RuntimeNotice({
  subscribe = onRuntimeNotice,
}: {
  subscribe?: typeof onRuntimeNotice
}) {
  const t = useT()
  const [queue] = useState(() => new ToastQueue<Notice>({ maxVisibleToasts: 3, exitDuration: 200 }))
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.trim()) queue.add({ message, tone: 'info' }, { timeout: 5000 })
    })
    // Eight seconds is long enough to read the cause, then the notice leaves.
    const unsubscribeActions = onActionNotice((message, tone) => {
      queue.add({ message, tone }, { timeout: tone === 'success' ? 5000 : 8000 })
    })
    const unsubscribePackages = onPackageBatchNotice((notice) => {
      queue.add(
        { message: notice.message, tone: notice.tone },
        { timeout: notice.tone === 'warning' ? 8000 : 5000 },
      )
    })
    return () => {
      unsubscribe()
      unsubscribeActions()
      unsubscribePackages()
      queue.clear()
    }
  }, [queue, subscribe])
  const modes: Record<string, Extract<MessageKey, `notifications.mode.${string}`>> = {
    lite: 'notifications.mode.lite',
    full: 'notifications.mode.full',
    ultra: 'notifications.mode.ultra',
    off: 'notifications.mode.off',
  }
  return (
    <Toast.Provider
      queue={queue}
      placement="bottom end"
      width={320}
      className="runtime-notice-region"
      aria-label={t('notifications.label')}
    >
      {({ toast }) => {
        const { message, tone } = toast.content
        const warning = tone === 'warning'
        const success = tone === 'success'
        const failure = warning ? actionNotice(message) : null
        // Only adapt a known plugin message; arbitrary extension text stays intact.
        const loaded =
          warning || success ? null : /^Ponytail loaded: (lite|full|ultra|off)$/.exec(message)
        const title = failure ? failure.title : loaded ? t('notifications.ponytailLoaded') : message
        const detail = failure
          ? failure.detail
          : loaded
            ? t('notifications.extensionDetail', {
                mode: t(modes[loaded[1]]),
                code: loaded[1],
              })
            : ''
        const Icon = loaded || success ? CircleCheck : warning ? TriangleAlert : Info
        const iconTone = loaded || success ? ' is-success' : warning ? ' is-warning' : ''
        return (
          <Toast toast={toast} className={`runtime-notice${warning ? ' is-warning' : ''}`}>
            <Toast.Indicator className="runtime-notice-indicator">
              <Icon className={`runtime-notice-icon${iconTone}`} aria-hidden="true" />
            </Toast.Indicator>
            <Toast.Content className="runtime-notice-copy">
              <Toast.Title className="runtime-notice-title" title={detail ? message : undefined}>
                {title}
              </Toast.Title>
              {detail && (
                <Toast.Description className="runtime-notice-detail">
                  {causeText(detail)}
                </Toast.Description>
              )}
            </Toast.Content>
            <Toast.CloseButton aria-label={t('common.close')} />
          </Toast>
        )
      }}
    </Toast.Provider>
  )
}
