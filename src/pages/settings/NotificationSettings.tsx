import { Button, Switch } from '@heroui/react'
import { Check, ExternalLink, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isDesktop } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import {
  readNotificationPermission,
  refreshNotificationPermission,
  reportNotificationError,
  testQuestionNotification,
  useNotificationStatus,
} from '../../lib/notifications'
import { SettingsSection } from './SettingsSection'
import { useNotificationPreferences } from './useNotificationPreferences'

export function NotificationSettings() {
  const { preferences, change, error, saving, retry } = useNotificationPreferences()
  const status = useNotificationStatus()
  const [operation, setOperation] = useState<'permission' | 'test' | null>(null)
  const busy = operation !== null
  const [tested, setTested] = useState(false)
  const t = useT()
  const mac = navigator.userAgent.includes('Mac')
  useEffect(() => {
    void refreshNotificationPermission()
    const refresh = () => {
      void refreshNotificationPermission()
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  async function enable(value: boolean) {
    if (!value) {
      change({ system: false })
      return
    }
    setOperation('permission')
    useNotificationStatus.setState({ error: '' })
    try {
      const permission = await readNotificationPermission(true)
      if (permission === 'granted' || permission === 'system') change({ system: true })
    } catch (error) {
      reportNotificationError(error)
    } finally {
      setOperation(null)
    }
  }
  const toggles = [
    {
      key: 'attention',
      label: t(mac ? 'notification.dock' : 'notification.icon'),
      help: t(mac ? 'notification.dockHelp' : 'notification.iconHelp'),
      disabled: !isDesktop,
    },
    {
      key: 'sound',
      label: t('notification.sound'),
      help: t(mac ? 'notification.soundHelp' : 'notification.soundSystemHelp'),
      disabled: !preferences.system || !mac,
    },
    {
      key: 'preview',
      label: t('notification.preview'),
      help: t('notification.previewHelp'),
      disabled: !preferences.system,
    },
  ] as const
  return (
    <SettingsSection id="settings-notifications" title={t('notification.settings')}>
      <div className="settings-rows notification-settings-rows">
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="notification-system-label">{t('notification.system')}</span>
            <p className="settings-help">{t('notification.systemHelp')}</p>
          </div>
          <Switch
            className="settings-inline-switch"
            aria-labelledby="notification-system-label"
            isSelected={preferences.system}
            isDisabled={!isDesktop || status.permission === 'unavailable' || busy || saving}
            onChange={(value) => {
              void enable(value)
            }}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </div>
        <div className="notification-permission" role="status">
          <span>{t(`notification.permission.${status.permission}`)}</span>
          {['denied', 'system'].includes(status.permission) && (
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                void invoke('open_notification_settings').catch(reportNotificationError)
              }}
            >
              {t('notification.openSystem')}
              <ExternalLink aria-hidden="true" />
            </Button>
          )}
        </div>
        {toggles.map(({ key, label, help, disabled }) => (
          <div className="settings-row" key={key}>
            <div className="settings-row-text">
              <span id={`notification-${key}`}>{label}</span>
              <p className="settings-help">{help}</p>
            </div>
            <Switch
              className="settings-inline-switch"
              aria-labelledby={`notification-${key}`}
              isSelected={preferences[key]}
              isDisabled={disabled || saving}
              onChange={(value) => change({ [key]: value })}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>
        ))}
      </div>
      {(error || status.error) && (
        <div className="notification-error" role="alert">
          <p>{error ? t('notification.saveFailed') : status.error}</p>
          {error && (
            <Button size="sm" variant="secondary" onPress={retry}>
              {t('common.retry')}
            </Button>
          )}
        </div>
      )}
      <div className="notification-test-row">
        <Button
          variant="secondary"
          isDisabled={
            !preferences.system ||
            !['granted', 'system'].includes(status.permission) ||
            busy ||
            saving
          }
          isPending={operation === 'test'}
          onPress={() => {
            setOperation('test')
            setTested(false)
            useNotificationStatus.setState({ error: '' })
            void testQuestionNotification()
              .then(() => setTested(true))
              .catch(reportNotificationError)
              .finally(() => setOperation(null))
          }}
        >
          <Send aria-hidden="true" />
          {t('notification.test')}
        </Button>
        {tested && (
          <span className="settings-saved" role="status">
            <Check aria-hidden="true" />
            {t('notification.testSent')}
          </span>
        )}
      </div>
    </SettingsSection>
  )
}
