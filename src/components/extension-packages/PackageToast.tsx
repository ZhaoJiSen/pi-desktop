import { Button, Toast, ToastQueue } from '@heroui/react'
import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n'
import type { ExtensionPackagesController } from './useExtensionPackages'

export function PackageToast({
  message,
  changed,
  busy,
  running,
  reload,
}: ExtensionPackagesController['toast']) {
  const t = useT()
  const [queue] = useState(() => new ToastQueue<{ message: string }>({ maxVisibleToasts: 1 }))
  useEffect(() => {
    queue.clear()
    if (message) queue.add({ message }, changed ? {} : { timeout: 5000 })
    return () => queue.clear()
  }, [queue, message, changed])
  return (
    <Toast.Provider
      queue={queue}
      placement="bottom end"
      width={360}
      aria-label={t('notifications.label')}
    >
      {({ toast }) => (
        <Toast toast={toast} className="package-reload-toast">
          <Toast.Content>
            <Toast.Title>{toast.content.message}</Toast.Title>
            {changed && (
              <Button
                variant="secondary"
                className="package-reload-toast-action"
                isDisabled={Boolean(busy) || running}
                onPress={() => void reload()}
              >
                {t('packages.reload')}
              </Button>
            )}
          </Toast.Content>
          <Toast.CloseButton aria-label={t('common.close')} />
        </Toast>
      )}
    </Toast.Provider>
  )
}
