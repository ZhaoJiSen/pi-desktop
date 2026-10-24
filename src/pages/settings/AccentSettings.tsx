import { ColorSwatchPicker } from '@heroui/react'
import { Check } from 'lucide-react'
import type { AccentColor, AccentOverrides, ColorMode } from '../../lib/appearance'
import { accentColors } from '../../lib/appearance'
import type { Translator } from '../../lib/locale'
import type { WorkspaceState } from '../../store/workspaceTypes'
import type { Palette } from '../../types'

const accents = Object.keys(accentColors) as AccentColor[]

export function AccentSettings({
  mode,
  accent,
  accentOverrides,
  accentKeyValue,
  setPreference,
  t,
  palette,
}: {
  mode: ColorMode
  accent: AccentColor | undefined
  accentOverrides: AccentOverrides
  accentKeyValue: keyof AccentOverrides
  setPreference: WorkspaceState['setPreference']
  t: Translator
  palette: Palette
}) {
  return (
    <ColorSwatchPicker
      key={mode}
      className="settings-accent-picker"
      aria-labelledby="settings-accent-label"
      value={accent ? accentColors[accent][mode] : '#00000000'}
      onChange={(color) => {
        const value = color.toString('hex').toLowerCase()
        const selected = accents.find((id) => accentColors[id][mode] === value)
        const next = { ...accentOverrides }
        if (selected) next[accentKeyValue] = selected
        else delete next[accentKeyValue]
        setPreference({ accentOverrides: next })
      }}
    >
      <ColorSwatchPicker.Item
        color="#00000000"
        aria-label={t('settings.accent.default')}
        className="settings-accent-default"
      >
        <ColorSwatchPicker.Swatch
          aria-hidden="true"
          className="palette-preview"
          data-palette={palette}
          data-theme={mode}
        />
        <ColorSwatchPicker.Indicator>
          <Check />
        </ColorSwatchPicker.Indicator>
      </ColorSwatchPicker.Item>
      {accents.map((id) => (
        <ColorSwatchPicker.Item
          key={id}
          color={accentColors[id][mode]}
          aria-label={t(`settings.accent.${id}`)}
        >
          <ColorSwatchPicker.Swatch aria-hidden="true" />
          <ColorSwatchPicker.Indicator />
        </ColorSwatchPicker.Item>
      ))}
    </ColorSwatchPicker>
  )
}
