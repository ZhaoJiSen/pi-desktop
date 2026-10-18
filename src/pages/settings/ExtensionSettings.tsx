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
          <p className="settings-help">{t('settings.reloadHelp')}</p>
          <button
            type="button"
            className="settings-text-link"
            onClick={() => void navigateToPage('extensions')}
          >
            {t('settings.manageExtensions')}
          </button>
        </div>
      </div>
    </SettingsSection>
  )
}
