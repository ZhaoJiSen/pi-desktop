import { Button, Label, ListBox, Popover, Radio, RadioGroup, Select } from '@heroui/react'
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useColorMode } from '../../hooks/useColorMode'
import { accentKey, palettesForMode, type ColorMode } from '../../lib/appearance'
import { useT } from '../../lib/i18n'
import { useWorkspace } from '../../store/workspace'
import type { Palette, Theme, WindowMaterial } from '../../types'
import { AccentSettings } from './AccentSettings'
import { FontSettings } from './FontSettings'
import { PalettePreview } from './PalettePreview'
import { SettingsSection } from './SettingsSection'

const paletteMessageNames = {
  ink: 'ink',
  gruvbox: 'gruvbox',
  everforest: 'everforest',
  catppuccin: 'catppuccin',
  'catppuccin-frappe': 'catppuccinFrappe',
  'catppuccin-macchiato': 'catppuccinMacchiato',
  linear: 'linear',
  nord: 'nord',
  ayu: 'ayu',
  'one-dark': 'oneDark',
  'min-dark': 'minDark',
  solarized: 'solarized',
  'rose-pine': 'rosePine',
  'rose-pine-moon': 'rosePineMoon',
  'tokyo-night': 'tokyoNight',
  'tokyo-night-storm': 'tokyoNightStorm',
  'tokyo-night-moon': 'tokyoNightMoon',
} as const

const themeOptions = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor },
] as const
const materials = ['off', 'blur', 'glass'] as const satisfies readonly WindowMaterial[]

export function AppearanceSettings() {
  const theme = useWorkspace((state) => state.theme)
  const palettesByMode = useWorkspace((state) => state.palettesByMode)
  const accentOverrides = useWorkspace((state) => state.accentOverrides)
  const windowMaterial = useWorkspace((state) => state.windowMaterial)
  const setPreference = useWorkspace((state) => state.setPreference)
  const mode = useColorMode(theme)
  const palette = palettesByMode[mode]
  const key = accentKey(mode, palette)
  const accent = accentOverrides[key]
  const [open, setOpen] = useState(false)
  const [hoveredPalette, setHoveredPalette] = useState<Palette | null>(null)
  const [focusedPalette, setFocusedPalette] = useState<Palette | null>(null)
  const previewPalette = hoveredPalette ?? focusedPalette
  const t = useT()
  const name = (id: Palette, colorMode: ColorMode) =>
    id === 'catppuccin-frappe' ||
    id === 'catppuccin-macchiato' ||
    id === 'rose-pine-moon' ||
    id === 'tokyo-night-storm' ||
    id === 'tokyo-night-moon'
      ? t(`settings.palette.${paletteMessageNames[id]}.dark`)
      : t(`settings.palette.${paletteMessageNames[id]}.${colorMode}`)
  function changeOpen(value: boolean) {
    setOpen(value)
    if (!value) {
      setHoveredPalette(null)
      setFocusedPalette(null)
    }
  }
  function preview(colorMode: ColorMode) {
    const id = colorMode === mode && previewPalette ? previewPalette : palettesByMode[colorMode]
    return (
      <PalettePreview
        palette={id}
        mode={colorMode}
        accent={accentOverrides[accentKey(colorMode, id)]}
      />
    )
  }
  return (
    <>
      <SettingsSection id="settings-appearance" title={t('settings.appearance')}>
        <div className="settings-theme-frame" data-preview={previewPalette ?? undefined}>
          <RadioGroup
            aria-label={t('settings.colorMode')}
            className="settings-themes"
            orientation="horizontal"
            value={theme}
            onChange={(value) => {
              changeOpen(false)
              setPreference({ theme: value as Theme })
            }}
          >
            {themeOptions.map(({ mode: optionMode, icon: Icon }) => (
              <Radio key={optionMode} value={optionMode} className="settings-theme">
                <Radio.Content className="settings-theme-content">
                  {optionMode === 'system' ? (
                    <span className="palette-preview-system" aria-hidden="true">
                      {preview('light')}
                      {preview('dark')}
                    </span>
                  ) : (
                    preview(optionMode)
                  )}
                  <span className="settings-theme-label">
                    <Icon aria-hidden="true" />
                    <Label>{t(`settings.theme.${optionMode}`)}</Label>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                  </span>
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
        </div>
        <div className="settings-rows">
          <div className="settings-row">
            <div className="settings-row-text">
              <span id="settings-material-label">{t('settings.material')}</span>
              <p className="settings-help">{t('settings.materialHelp')}</p>
            </div>
            <Select
              className="settings-material-select"
              variant="secondary"
              aria-labelledby="settings-material-label"
              value={windowMaterial}
              onChange={(next) => {
                if (materials.includes(next as WindowMaterial))
                  setPreference({ windowMaterial: next as WindowMaterial })
              }}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom end">
                <ListBox>
                  {materials.map((item) => (
                    <ListBox.Item key={item} id={item} textValue={t(`settings.material.${item}`)}>
                      {t(`settings.material.${item}`)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="settings-row settings-palette-row">
            <div className="settings-row-text">
              <span id="settings-palette-label">{t('settings.palette')}</span>
              <p className="settings-palette-hint">{t('settings.paletteHelp')}</p>
            </div>
            <Popover isOpen={open} onOpenChange={changeOpen}>
              <Button
                className="settings-palette-trigger"
                variant="secondary"
                aria-labelledby="settings-palette-label settings-palette-value"
              >
                <span
                  className="settings-palette-chip palette-preview"
                  data-palette={palette}
                  data-theme={mode}
                  aria-hidden="true"
                />
                <span id="settings-palette-value">{name(palette, mode)}</span>
                <ChevronDown aria-hidden="true" />
              </Button>
              <Popover.Content
                className="settings-palette-popover"
                placement="bottom end"
                offset={8}
                containerPadding={16}
              >
                <Popover.Dialog aria-label={t('settings.choosePalette')}>
                  <Popover.Heading>
                    {t('settings.paletteHeading', { mode: t(`settings.theme.${mode}`) })}
                  </Popover.Heading>
                  <div
                    className="settings-palette-options"
                    onKeyDownCapture={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        event.stopPropagation()
                        changeOpen(false)
                      }
                    }}
                  >
                    <ListBox
                      className="settings-palette-grid"
                      aria-label={t('settings.choosePalette')}
                      layout="grid"
                      selectionMode="single"
                      disallowEmptySelection
                      selectedKeys={[palette]}
                      onSelectionChange={(keys) => {
                        if (keys === 'all') return
                        const id = [...keys][0] as Palette
                        if (!palettesForMode(mode).includes(id)) return
                        setPreference({ palette: id })
                        changeOpen(false)
                      }}
                    >
                      {palettesForMode(mode).map((id) => (
                        <ListBox.Item
                          key={id}
                          id={id}
                          textValue={name(id, mode)}
                          className="settings-palette-option"
                          onClick={() => {
                            if (id === palette) changeOpen(false)
                          }}
                          onAction={() => changeOpen(false)}
                          onHoverStart={() => setHoveredPalette(id)}
                          onHoverEnd={() => setHoveredPalette(null)}
                          onFocus={() => setFocusedPalette(id)}
                        >
                          <span className="settings-palette-thumbnail" aria-hidden="true">
                            <PalettePreview
                              palette={id}
                              mode={mode}
                              accent={accentOverrides[accentKey(mode, id)]}
                            />
                            <span className="settings-palette-option-check">
                              <Check />
                            </span>
                          </span>
                          <span className="settings-palette-option-label">{name(id, mode)}</span>
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </div>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          </div>
          <div className="settings-row settings-accent-row">
            <div className="settings-row-text">
              <span id="settings-accent-label">{t('settings.accent')}</span>
              <p className="settings-palette-hint" aria-live="polite">
                {accent ? t(`settings.accent.${accent}`) : t('settings.accent.default')}
              </p>
            </div>
            <AccentSettings
              mode={mode}
              accent={accent}
              accentOverrides={accentOverrides}
              accentKeyValue={key}
              setPreference={setPreference}
              t={t}
              palette={palette}
            />
          </div>
        </div>
      </SettingsSection>
      <FontSettings />
    </>
  )
}
