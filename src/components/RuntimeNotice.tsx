import { Toast, ToastQueue } from '@heroui/react'
import { CircleCheck, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { onRuntimeNotice } from '../lib/desktop'
import { useT } from '../lib/i18n'
import type { MessageKey } from '../lib/locale'

export function RuntimeNotice({
  subscribe = onRuntimeNotice,
}: {
  subscribe?: typeof onRuntimeNotice
}) {
  const t = useT()
  const [queue] = useState(
    () => new ToastQueue<{ message: string }>({ maxVisibleToasts: 3, exitDuration: 200 }),
  )
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.trim()) queue.add({ message }, { timeout: 5000 })
    })
    return () => {
      unsubscribe()
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
      placement="top end"
      width={320}
      className="runtime-notice-region"
      aria-label={t('notifications.label')}
    >
      {({ toast }) => {
        const { message } = toast.content
        // Only adapt a known plugin message; arbitrary extension text stays intact.
        const loaded = /^Ponytail loaded: (lite|full|ultra|off)$/.exec(message)
        const Icon = loaded ? CircleCheck : Info
        return (
          <Toast toast={toast} className="runtime-notice">
            <Toast.Indicator className="runtime-notice-indicator">
              <Icon
                className={`runtime-notice-icon${loaded ? ' is-success' : ''}`}
                aria-hidden="true"
              />
            </Toast.Indicator>
            <Toast.Content className="runtime-notice-copy">
              <Toast.Title className="runtime-notice-title" title={loaded ? message : undefined}>
                {loaded ? t('notifications.ponytailLoaded') : message}
              </Toast.Title>
              {loaded && (
                <Toast.Description className="runtime-notice-detail">
                  {t('notifications.extensionDetail', {
                    mode: t(modes[loaded[1]]),
                    code: loaded[1],
                  })}
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
