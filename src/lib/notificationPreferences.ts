export interface NotificationPreferences {
  system: boolean
  attention: boolean
  sound: boolean
  preview: boolean
}

export const defaultNotificationPreferences: NotificationPreferences = {
  system: false,
  attention: true,
  sound: false,
  preview: false,
}

export function restoreNotificationPreferences(value: unknown): NotificationPreferences {
  const saved = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return Object.fromEntries(
    Object.entries(defaultNotificationPreferences).map(([key, fallback]) => [
      key,
      typeof saved[key] === 'boolean' ? saved[key] : fallback,
    ]),
  ) as unknown as NotificationPreferences
}
