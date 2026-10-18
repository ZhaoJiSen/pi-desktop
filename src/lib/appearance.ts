import { palettes, type Palette, type Theme } from '../types'

export type ColorMode = 'light' | 'dark'
export type ModePalettes = Record<ColorMode, Palette>
export const accentColors = {
  graphite: { light: '#4b5563', dark: '#cbd5e1' },
  blue: { light: '#245dce', dark: '#8bb4ff' },
  violet: { light: '#7446c8', dark: '#c4a2f5' },
  pink: { light: '#ac3974', dark: '#efa1c9' },
  red: { light: '#b83e40', dark: '#f49b96' },
  orange: { light: '#a75014', dark: '#f4b077' },
  green: { light: '#287747', dark: '#8acf9f' },
  teal: { light: '#147673', dark: '#80ccc6' },
} as const
export type AccentColor = keyof typeof accentColors
export type AccentOverrides = Partial<Record<`${ColorMode}:${Palette}`, AccentColor>>

// Explicit availability also supports themes with only one mode in future.
export const paletteModes: Record<Palette, readonly ColorMode[]> = {
  ink: ['light', 'dark'],
  gruvbox: ['light', 'dark'],
  everforest: ['light', 'dark'],
  catppuccin: ['light', 'dark'],
  'catppuccin-frappe': ['dark'],
  'catppuccin-macchiato': ['dark'],
  linear: ['light', 'dark'],
  nord: ['light', 'dark'],
  ayu: ['light', 'dark'],
  'one-dark': ['light', 'dark'],
  'min-dark': ['light', 'dark'],
  solarized: ['light', 'dark'],
  'rose-pine': ['light', 'dark'],
  'rose-pine-moon': ['dark'],
  'tokyo-night': ['light', 'dark'],
  'tokyo-night-storm': ['dark'],
  'tokyo-night-moon': ['dark'],
}

export function palettesForMode(mode: ColorMode) {
  return palettes.filter((palette) => paletteModes[palette].includes(mode))
}

export function resolveColorMode(theme: Theme, systemDark = false): ColorMode {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}

export function systemIsDark() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function accentKey(mode: ColorMode, palette: Palette): keyof AccentOverrides {
  return `${mode}:${palette}`
}

export function accentForeground(mode: ColorMode) {
  return mode === 'dark' ? '#151720' : '#ffffff'
}

export function restoreModePalettes(value: unknown, legacy: Palette): ModePalettes {
  const saved = value as Partial<ModePalettes> | undefined
  const valid = (mode: ColorMode) => {
    const available = palettesForMode(mode)
    if (available.includes(saved?.[mode] as Palette)) return saved![mode]!
    if (available.includes(legacy)) return legacy
    // Restore a supported version of the same family when a dark-only variant is unavailable.
    for (const family of ['catppuccin', 'rose-pine', 'tokyo-night'] as const) {
      if (legacy.startsWith(`${family}-`) && available.includes(family)) return family
    }
    return 'ink'
  }
  return { light: valid('light'), dark: valid('dark') }
}

export function restoreAccentOverrides(value: unknown): AccentOverrides {
  if (!value || typeof value !== 'object') return {}
  const result: AccentOverrides = {}
  for (const mode of ['light', 'dark'] as const) {
    for (const palette of palettesForMode(mode)) {
      const key = accentKey(mode, palette)
      const accent = (value as Record<string, unknown>)[key]
      if (typeof accent === 'string' && Object.hasOwn(accentColors, accent))
        result[key] = accent as AccentColor
    }
  }
  return result
}

export function applyAppearance(
  root: HTMLElement,
  mode: ColorMode,
  palette: Palette,
  accent: AccentColor | undefined,
) {
  root.dataset.theme = mode
  root.dataset.palette = palette
  root.dataset.accent = accent ?? 'default'
  const color = accent ? accentColors[accent][mode] : null
  for (const [property, value] of Object.entries({
    '--accent': color,
    '--accent-foreground': color ? accentForeground(mode) : null,
    '--focus': color,
  })) {
    if (value) root.style.setProperty(property, value)
    else root.style.removeProperty(property)
  }
}
