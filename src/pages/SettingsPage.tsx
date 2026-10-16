import {
  Button,
  Description,
  Input,
  Label,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react'
import { Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { connectSession } from '../lib/desktop'
import { palettes, type Palette, type Theme } from '../types'

const themeOptions = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor },
] as const

export function SettingsPage() {
  const autoReloadAfterToggle = useWorkspace((state) => state.autoReloadAfterToggle)
  const autoReload = useWorkspace((state) => state.autoReloadAfterUpdate)
  const theme = useWorkspace((state) => state.theme)
  const palette = useWorkspace((state) => state.palette)
  const language = useWorkspace((state) => state.language)
  const executable = useWorkspace((state) => state.piExecutable)
  const active = useWorkspace((state) => state.activeSessionId)
  const connection = useWorkspace((state) => state.connection)
  const running = useWorkspace((state) => state.runningSessionId)
  const setPreference = useWorkspace((state) => state.setPreference)
  const storageError = useWorkspace((state) => state.storageError)
  const [path, setPath] = useState(executable)
  const [saved, setSaved] = useState(false)
  const t = useT()
  const busy = Boolean(running) || connection === 'connecting'
  async function save() {
    if (busy) return
    setPreference({ piExecutable: path.trim() || 'pi' })
    setSaved(true)
    if (active) await connectSession(active, true)
  }
  return (
    <div className="utility-view settings-view">
      <div className="settings-content">
        <section className="settings-section" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance">{t('settings.appearance')}</h2>
          <div className="settings-section-body">
            <RadioGroup
              aria-label={t('settings.appearance')}
              className="settings-themes"
              orientation="horizontal"
              value={theme}
              onChange={(value) => setPreference({ theme: value as Theme })}
            >
              {themeOptions.map(({ mode, icon: Icon }) => (
                <Radio key={mode} value={mode} className="settings-theme">
                  <Radio.Content className="settings-theme-content">
                    <span
                      className={`settings-preview settings-preview--${mode}`}
                      aria-hidden="true"
                    >
                      <span className="settings-preview-sidebar">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="settings-preview-main">
                        <span className="settings-preview-line" />
                        <span className="settings-preview-bubble" />
                        <span className="settings-preview-line" />
                        <span className="settings-preview-input" />
                      </span>
                    </span>
                    <span className="settings-theme-label">
                      <Icon aria-hidden="true" />
                      <Label>{t(`settings.theme.${mode}`)}</Label>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                    </span>
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>
            <div className="settings-palette-block">
              <span id="settings-palette-label">{t('settings.palette')}</span>
              <RadioGroup
                aria-labelledby="settings-palette-label"
                className="settings-palettes"
                orientation="horizontal"
                value={palette}
                onChange={(value) => setPreference({ palette: value as Palette })}
              >
                {palettes.map((id) => (
                  <Radio key={id} value={id} className="settings-palette">
                    <Radio.Content className="settings-palette-content">
                      <span
                        className={`settings-swatch settings-swatch--${id}`}
                        aria-hidden="true"
                      />
                      <Label>{t(`settings.palette.${id}`)}</Label>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>
            </div>
            <div className="settings-language">
              <span id="settings-language-label">{t('settings.language')}</span>
              <ToggleButtonGroup
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
          </div>
        </section>
        <section className="settings-section" aria-labelledby="settings-extensions">
          <h2 id="settings-extensions">{t('settings.extensions')}</h2>
          <div className="settings-section-body settings-switches">
            <Switch
              className="settings-switch"
              aria-describedby="settings-reload-help"
              isSelected={autoReload}
              onChange={(value) => setPreference({ autoReloadAfterUpdate: value })}
            >
              <Switch.Content>
                <Label>{t('settings.autoReloadAfterUpdate')}</Label>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
              <Description>{t('settings.autoReloadAfterUpdateHelp')}</Description>
            </Switch>
            <Switch
              className="settings-switch"
              aria-describedby="settings-reload-help"
              isSelected={autoReloadAfterToggle}
              onChange={(value) => setPreference({ autoReloadAfterToggle: value })}
            >
              <Switch.Content>
                <Label>{t('settings.autoReloadAfterToggle')}</Label>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
              <Description>{t('settings.autoReloadAfterToggleHelp')}</Description>
            </Switch>
            <p id="settings-reload-help" className="settings-help">
              {t('settings.reloadHelp')}
            </p>
          </div>
        </section>
        <section className="settings-section" aria-labelledby="settings-connection">
          <h2 id="settings-connection">{t('settings.connection')}</h2>
          <form
            className="settings-section-body"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <TextField
              fullWidth
              value={path}
              onChange={(value) => {
                setPath(value)
                setSaved(false)
              }}
            >
              <Label>{t('settings.executable')}</Label>
              <Input
                variant="secondary"
                className="settings-path"
                placeholder="pi"
                spellCheck={false}
              />
              <Description>{t('settings.executableHelp')}</Description>
            </TextField>
            <div className="settings-save-row">
              <span className="settings-saved" role="status">
                {saved && !storageError && (
                  <>
                    <Check aria-hidden="true" />
                    {t('settings.saved')}
                  </>
                )}
              </span>
              <Button type="submit" isDisabled={busy}>
                <RotateCcw aria-hidden="true" />
                {t('settings.saveReconnect')}
              </Button>
            </div>
          </form>
        </section>
        <section className="settings-section" aria-labelledby="settings-onboarding">
          <h2 id="settings-onboarding">{t('onboarding.settingsTitle')}</h2>
          <div className="settings-section-body settings-onboarding">
            <p className="settings-help">{t('onboarding.settingsHelp')}</p>
            <Button
              variant="secondary"
              isDisabled={busy}
              onPress={() => useWorkspace.getState().openOnboarding()}
            >
              {t('onboarding.reopen')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
