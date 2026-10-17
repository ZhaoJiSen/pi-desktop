import {
  Button,
  Description,
  Input,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react'
import { Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { connectSession } from '../lib/desktop'
import { navigateToPage } from '../router/navigation'
import { palettes, type Palette, type Theme } from '../types'

const themeOptions = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor },
] as const

let settingsIntroPlayed = false

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
  const [outcome, setOutcome] = useState<'saved' | 'reconnected' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hoveredPalette, setHoveredPalette] = useState<Palette | null>(null)
  const [focusedPalette, setFocusedPalette] = useState<Palette | null>(null)
  const pathTouched = useRef(false)
  const reduced = useReducedMotion()
  const [intro] = useState(() => !settingsIntroPlayed && reduced === false)
  useEffect(() => {
    settingsIntroPlayed = true
  }, [])
  useEffect(() => {
    if (!pathTouched.current) setPath(executable)
  }, [executable])
  const t = useT()
  const busy = Boolean(running) || connection === 'connecting'
  const draft = path.trim() || 'pi'
  const dirty = draft !== executable
  const previewPalette = hoveredPalette ?? focusedPalette
  const rowError = storageError || saveError
  function editPath(value: string) {
    pathTouched.current = true
    setPath(value)
    setOutcome(null)
    setSaveError(null)
  }
  function previewPaletteBy(value: string) {
    if ((palettes as readonly string[]).includes(value)) {
      setHoveredPalette(value as Palette)
      setFocusedPalette(value as Palette)
    }
  }
  function clearPalettePreview() {
    setHoveredPalette(null)
    setFocusedPalette(null)
  }
  async function save() {
    if (busy) return
    const next = path.trim() || 'pi'
    pathTouched.current = true
    setPath(next)
    setOutcome(null)
    setSaveError(null)
    setPreference({ piExecutable: next })
    await Promise.resolve()
    const stored = useWorkspace.getState()
    if (stored.storageError) return
    if (!active || stored.piUpdating) {
      setOutcome('saved')
      return
    }
    await connectSession(active, true)
    const after = useWorkspace.getState()
    if (after.storageError) return
    if (after.connection === 'connected') {
      setOutcome('reconnected')
      return
    }
    if (after.connectionError || after.connection === 'error') {
      setSaveError(after.connectionError || t('connection.failed'))
      return
    }
    setOutcome('saved')
  }
  return (
    <motion.div
      className="utility-view settings-view"
      initial={intro ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="settings-content">
        <header className="settings-heading">
          <h1 className="utility-page-title">{t('navigation.settings')}</h1>
        </header>
        <section className="settings-section" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance">{t('settings.appearance')}</h2>
          <div className="settings-theme-frame" data-preview={previewPalette ?? undefined}>
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
          </div>
          <div className="settings-row settings-palette-row">
            <span id="settings-palette-label">{t('settings.palette')}</span>
            <Select
              className="settings-palette-select"
              aria-labelledby="settings-palette-label"
              value={palette}
              onOpenChange={(open) => {
                if (!open) clearPalettePreview()
              }}
              onChange={(value) => {
                if (value == null || !(palettes as readonly string[]).includes(String(value)))
                  return
                clearPalettePreview()
                setPreference({ palette: value as Palette })
              }}
            >
              <Select.Trigger>
                <Select.Value>{t(`settings.palette.${palette}`)}</Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox aria-labelledby="settings-palette-label">
                  {palettes.map((id) => (
                    <ListBox.Item
                      key={id}
                      id={id}
                      textValue={t(`settings.palette.${id}`)}
                      onHoverStart={() => previewPaletteBy(id)}
                      onFocus={() => previewPaletteBy(id)}
                    >
                      {t(`settings.palette.${id}`)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </section>
        <section className="settings-section" aria-labelledby="settings-general">
          <h2 id="settings-general">{t('settings.general')}</h2>
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
        </section>
        <section className="settings-section" aria-labelledby="settings-extensions">
          <h2 id="settings-extensions">{t('settings.extensions')}</h2>
          <div className="settings-switches">
            <Switch
              className="settings-switch"
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
        </section>
        <section className="settings-section" aria-labelledby="settings-connection">
          <h2 id="settings-connection">{t('settings.connection')}</h2>
          <p className="settings-status" role="status">
            <span>{t(`settings.status.${connection}`)}</span>
            <span className="settings-status-sep" aria-hidden="true">
              ·
            </span>
            <span className="settings-status-path">{executable}</span>
            {dirty && <span className="settings-status-flag">{t('settings.unapplied')}</span>}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <TextField fullWidth value={path} onChange={editPath}>
              <Label>{t('settings.executable')}</Label>
              <Input
                variant="secondary"
                className="settings-path"
                placeholder="pi"
                spellCheck={false}
              />
              <Description>{t('settings.executableHelp')}</Description>
            </TextField>
            {rowError && (
              <p className="settings-error" role="alert">
                {rowError}
              </p>
            )}
            {busy && (
              <p id="settings-reconnect-busy" className="settings-help settings-busy">
                {t('settings.reconnectBusy')}
              </p>
            )}
            <div className="settings-save-row">
              <Button
                type="button"
                variant="ghost"
                isDisabled={draft === 'pi'}
                onPress={() => editPath('pi')}
              >
                {t('settings.restoreExecutable')}
              </Button>
              <div className="settings-save-actions">
                <span className="settings-saved" role="status">
                  {outcome && !rowError && (
                    <span key={outcome} className="settings-saved-result">
                      <Check aria-hidden="true" />
                      {t(outcome === 'reconnected' ? 'settings.reconnected' : 'settings.saved')}
                    </span>
                  )}
                </span>
                <Button
                  type="submit"
                  isDisabled={busy}
                  aria-describedby={busy ? 'settings-reconnect-busy' : undefined}
                >
                  <RotateCcw aria-hidden="true" />
                  {t('settings.saveReconnect')}
                </Button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </motion.div>
  )
}
