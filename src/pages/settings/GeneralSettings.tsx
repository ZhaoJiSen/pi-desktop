import { Button, Switch, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import { SettingsSection } from './SettingsSection'

export function GeneralSettings() {
  const language = useWorkspace((state) => state.language)
  const wrapLines = useWorkspace((state) => state.wrapLines)
  const setPreference = useWorkspace((state) => state.setPreference)
  const busy = useWorkspace(
    (state) => Boolean(state.runningSessionId) || state.connection === 'connecting',
  )
  const t = useT()
  return (
    <SettingsSection id="settings-general" title={t('settings.general')}>
      <div className="settings-rows">
        <div className="settings-row">
          <span id="settings-language-label">{t('settings.language')}</span>
          <ToggleButtonGroup
            className="settings-language"
            aria-labelledby="settings-language-label"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[language]}
            onSelectionChange={(keys) => {
              if (keys.has('zh')) setPreference({ language: 'zh' })
              else if (keys.has('en')) setPreference({ language: 'en' })
            }}
          >
            <ToggleButton id="zh">{t('languages.zh')}</ToggleButton>
            <ToggleButton id="en">{t('languages.en')}</ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <span id="settings-wrap-label">{t('settings.wrapLines')}</span>
            <p className="settings-help">{t('settings.wrapLinesHelp')}</p>
          </div>
          <Switch
            className="settings-inline-switch"
            aria-labelledby="settings-wrap-label"
            isSelected={wrapLines}
            onChange={(value) => setPreference({ wrapLines: value })}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <span>{t('onboarding.settingsTitle')}</span>
            <p className="settings-help">{t('onboarding.settingsHelp')}</p>
          </div>
          <Button
            variant="secondary"
            isDisabled={busy}
            onPress={() => useWorkspace.getState().openOnboarding()}
          >
            {t('onboarding.reopen')}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
