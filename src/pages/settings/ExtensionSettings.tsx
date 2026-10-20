import { Button } from '@heroui/react'
import { ArrowUpRight } from 'lucide-react'
import { navigateToPage } from '../../router/navigation'
import { SettingsSwitch } from './SettingsSwitch'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import { SettingsSection } from './SettingsSection'

export function ExtensionSettings() {
  const autoReloadAfterToggle = useWorkspace((state) => state.autoReloadAfterToggle)
  const autoReload = useWorkspace((state) => state.autoReloadAfterUpdate)
  const setPreference = useWorkspace((state) => state.setPreference)
  const t = useT()
  return (
    <SettingsSection id="settings-extensions" title={t('settings.extensions')}>
      <div className="settings-switches">
        <SettingsSwitch
          label={t('settings.autoReloadAfterUpdate')}
          description={t('settings.autoReloadAfterUpdateHelp')}
          isSelected={autoReload}
          onChange={(value) => setPreference({ autoReloadAfterUpdate: value })}
        />
        <SettingsSwitch
          label={t('settings.autoReloadAfterToggle')}
          description={t('settings.autoReloadAfterToggleHelp')}
          isSelected={autoReloadAfterToggle}
          onChange={(value) => setPreference({ autoReloadAfterToggle: value })}
        />
        <div className="settings-row">
          <div className="settings-row-text">
            <span>{t('settings.manageExtensions')}</span>
            <p className="settings-help">{t('settings.reloadHelp')}</p>
          </div>
          <Button variant="secondary" onPress={() => void navigateToPage('extensions')}>
            {t('settings.manageExtensions')}
            <ArrowUpRight />
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
