import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window'
import { isPermissionGranted, onAction, requestPermission } from '@tauri-apps/plugin-notification'
import { create } from 'zustand'
import { isDesktop, useWorkspace } from '../store/workspace'
import { t } from './i18n'
import { errorText } from './utils'
import type { NotificationPreferences } from './notificationPreferences'

export type NotificationPermissionState =
  | 'unknown'
  | 'default'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'system'
export const useNotificationStatus = create<{
  permission: NotificationPermissionState
  error: string
}>(() => ({ permission: 'unknown', error: '' }))

// Tauri's desktop permission API reports Granted even when macOS denied access.
// Query the actual macOS authorization state through the native bridge instead.
export async function readNotificationPermission(
  request = false,
): Promise<NotificationPermissionState> {
  if (!isDesktop) {
    useNotificationStatus.setState({ permission: 'unavailable' })
    return 'unavailable'
  }
  const native = await invoke<NotificationPermissionState | null>('notification_permission', {
    request,
  })
  const fallback =
    native === null
      ? request
        ? await requestPermission()
        : (await isPermissionGranted())
          ? 'granted'
          : window.Notification.permission
      : null
  const permission = native ?? (fallback === 'granted' ? 'system' : fallback!)
  useNotificationStatus.setState({ permission })
  return permission
}

export async function refreshNotificationPermission() {
  try {
    return await readNotificationPermission()
  } catch (error) {
    useNotificationStatus.setState({ permission: 'unknown', error: errorText(error) })
    return 'unknown' as const
  }
}

let sequence = Math.floor(Date.now() % 1_000_000_000)
export async function showQuestionNotification(
  body: string,
  questionKey: string | null,
  preferences: NotificationPreferences,
  relevant: () => boolean = () => true,
) {
  if (!relevant()) return
  const permission = await readNotificationPermission()
  if (!relevant()) return
  if (!['granted', 'system'].includes(permission)) throw new Error(t('notification.permissionHelp'))
  // Await IPC directly: the plugin's public Notification constructor returns void
  // and cannot report a failed send back to this settings page.
  await invoke('plugin:notification|notify', {
    options: {
      id: ++sequence,
      title: questionKey ? t('notification.needsAnswer') : t('notification.testTitle'),
      body,
      sound: preferences.sound && navigator.userAgent.includes('Mac') ? 'Ping' : undefined,
      extra: { questionKey },
    },
  })
}

export async function requestQuestionAttention() {
  if (isDesktop) await getCurrentWindow().requestUserAttention(UserAttentionType.Informational)
}

export async function focusApplication() {
  if (!isDesktop) return
  const window = getCurrentWindow()
  await window.unminimize()
  await window.show()
  await window.setFocus()
}

export function listenNotificationActions(open: (key: string) => void) {
  return onAction((event) => {
    const key = event.notification?.extra?.questionKey
    if (typeof key === 'string') open(key)
  })
}

export function reportNotificationError(error: unknown) {
  useNotificationStatus.setState({ error: errorText(error) })
}

export async function testQuestionNotification() {
  const preferences = useWorkspace.getState().notificationPreferences
  await showQuestionNotification(t('notification.testBody'), null, preferences)
}
