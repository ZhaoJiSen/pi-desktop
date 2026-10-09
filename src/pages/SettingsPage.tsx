import { Button, Switch } from '@heroui/react'
import { Check, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { connectSession } from '../lib/desktop'
import type { Theme } from '../types'

export function SettingsPage() {
  const autoReloadAfterToggle = useWorkspace((state) => state.autoReloadAfterToggle)
  const autoReload = useWorkspace((state) => state.autoReloadAfterUpdate)
  const theme = useWorkspace((state) => state.theme)
  const language = useWorkspace((state) => state.language)
  const executable = useWorkspace((state) => state.piExecutable)
  const active = useWorkspace((state) => state.activeSessionId)
  const connection = useWorkspace((state) => state.connection)
  const running = useWorkspace((state) => state.runningSessionId)
  const setPreference = useWorkspace((state) => state.setPreference)
  const [path, setPath] = useState(executable)
  const [saved, setSaved] = useState(false)
  const t = useT()
  async function save() {
    setPreference({ piExecutable: path.trim() || 'pi' })
    setSaved(true)
    if (active) await connectSession(active, true)
  }
  return (
    <div className="utility-view settings-view">
      <section className="settings-section">
        <h2>{t('settings.appearance')}</h2>
        <div className="theme-options">
          {(['light', 'dark', 'system'] as Theme[]).map((mode) => (
            <Button
              key={mode}
              variant="secondary"
              className={`theme-option ${theme === mode ? 'active' : ''}`}
              onPress={() => setPreference({ theme: mode })}
              aria-pressed={theme === mode}
            >
              {mode === 'dark' ? <Moon /> : <Sun />}
              <span>{t(`settings.theme.${mode}`)}</span>
              {theme === mode && <Check />}
            </Button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h2>{t('settings.language')}</h2>
        <div className="segment">
          <Button
            variant="ghost"
            className={language === 'zh' ? 'active' : ''}
            onPress={() => setPreference({ language: 'zh' })}
          >
            {t('languages.zh')}
          </Button>
          <Button
            variant="ghost"
            className={language === 'en' ? 'active' : ''}
            onPress={() => setPreference({ language: 'en' })}
          >
            {t('languages.en')}
          </Button>
        </div>
      </section>
      <section className="settings-section">
        <h2>{t('settings.extensions')}</h2>
        <Switch
          isSelected={autoReload}
          onChange={(value) => setPreference({ autoReloadAfterUpdate: value })}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            {t('settings.autoReloadAfterUpdate')}
          </Switch.Content>
        </Switch>
        <p className="setting-help">{t('settings.autoReloadAfterUpdateHelp')}</p>
        <Switch
          isSelected={autoReloadAfterToggle}
          onChange={(value) => setPreference({ autoReloadAfterToggle: value })}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            {t('settings.autoReloadAfterToggle')}
          </Switch.Content>
        </Switch>
        <p className="setting-help">{t('settings.autoReloadAfterToggleHelp')}</p>
      </section>
      <section className="settings-section">
        <h2>{t('onboarding.settingsTitle')}</h2>
        <p className="setting-help">{t('onboarding.settingsHelp')}</p>
        <Button
          variant="secondary"
          isDisabled={Boolean(running) || connection === 'connecting'}
          onPress={() => useWorkspace.getState().openOnboarding()}
        >
          {t('onboarding.reopen')}
        </Button>
      </section>
      <section className="settings-section">
        <h2>{t('settings.executable')}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="field-label">
            <input
              className="field-input"
              aria-label={t('settings.executable')}
              value={path}
              onChange={(event) => {
                setPath(event.target.value)
                setSaved(false)
              }}
              placeholder="pi"
            />
          </label>
          <p className="setting-help">{t('settings.executableHelp')}</p>
          <Button type="submit" isDisabled={Boolean(running) || connection === 'connecting'}>
            {saved ? <Check /> : null}
            {t('settings.saveReconnect')}
          </Button>
        </form>
      </section>
    </div>
  )
}
