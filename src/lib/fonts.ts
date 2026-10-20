export type FontLeading = 'compact' | 'standard' | 'loose'

export type FontPreferences = {
  uiFamily: string | null
  uiSize: number
  readingSize: number
  readingLeading: FontLeading
  codeFamily: string | null
  codeSize: number
  codeLeading: FontLeading
  codeFallback: string | null
  ligatures: boolean
}

export type SystemFont = {
  family: string
  monospace: boolean
}

export const defaultFonts: FontPreferences = {
  uiFamily: null,
  uiSize: 14,
  readingSize: 15,
  readingLeading: 'standard',
  codeFamily: null,
  codeSize: 13,
  codeLeading: 'standard',
  codeFallback: null,
  ligatures: false,
}

export const uiSizeRange = { min: 12, max: 16 }
export const readingSizeRange = { min: 14, max: 18 }
export const codeSizeRange = { min: 11, max: 18 }

export const readingLeadingScale = { compact: 1.45, standard: 1.7, loose: 1.95 }
export const codeLeadingScale = { compact: 1.45, standard: 1.75, loose: 2 }

export const systemUiStack =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif'
const systemCodeFaces = 'ui-monospace, SFMono-Regular, Menlo'

let catalog: SystemFont[] | null = null
let loading: Promise<SystemFont[]> | null = null

export function quoteFamily(name: string) {
  return `"${name.replace(/["\\]/g, '')}"`
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function familyName(value: unknown) {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (!name || name.length > 80 || /["\\\n\r]/.test(name)) return null
  return name
}

function leading(value: unknown): FontLeading {
  return value === 'compact' || value === 'loose' ? value : 'standard'
}

export function restoreFonts(value: unknown): FontPreferences {
  const saved = value && typeof value === 'object' ? (value as Partial<FontPreferences>) : {}
  return {
    uiFamily: familyName(saved.uiFamily),
    uiSize: clamp(saved.uiSize, uiSizeRange.min, uiSizeRange.max, defaultFonts.uiSize),
    readingSize: clamp(
      saved.readingSize,
      readingSizeRange.min,
      readingSizeRange.max,
      defaultFonts.readingSize,
    ),
    readingLeading: leading(saved.readingLeading),
    codeFamily: familyName(saved.codeFamily),
    codeSize: clamp(saved.codeSize, codeSizeRange.min, codeSizeRange.max, defaultFonts.codeSize),
    codeLeading: leading(saved.codeLeading),
    codeFallback: familyName(saved.codeFallback),
    ligatures: saved.ligatures === true,
  }
}

export function fontsEqual(left: FontPreferences, right: FontPreferences) {
  return (Object.keys(defaultFonts) as (keyof FontPreferences)[]).every(
    (key) => left[key] === right[key],
  )
}

export function fontsMatchDefault(fonts: FontPreferences) {
  return fontsEqual(fonts, defaultFonts)
}

function knownFamily(family: string | null) {
  if (!family) return null
  if (!catalog?.length) return family
  return catalog.some((font) => font.family === family) ? family : null
}

export function fontStacks(fonts: FontPreferences) {
  const ui = knownFamily(fonts.uiFamily)
  const code = knownFamily(fonts.codeFamily)
  const fallback = knownFamily(fonts.codeFallback) ?? ui
  const cjk = fallback ? quoteFamily(fallback) : '"PingFang SC"'
  return {
    ui: ui ? `${quoteFamily(ui)}, ${systemUiStack}` : systemUiStack,
    code: [code ? quoteFamily(code) : null, systemCodeFaces, cjk, 'sans-serif']
      .filter(Boolean)
      .join(', '),
    missingUi: Boolean(fonts.uiFamily && catalog?.length && !ui),
    missingCode: Boolean(fonts.codeFamily && catalog?.length && !code),
    missingFallback: Boolean(
      fonts.codeFallback && catalog?.length && !knownFamily(fonts.codeFallback),
    ),
  }
}

export function applyFonts(root: HTMLElement, fonts: FontPreferences) {
  const stacks = fontStacks(fonts)
  root.style.setProperty('--font-ui', stacks.ui)
  root.style.setProperty('--font-ui-size', String(fonts.uiSize))
  root.style.setProperty('--font-reading-size', `${fonts.readingSize}px`)
  root.style.setProperty(
    '--font-reading-leading',
    String(readingLeadingScale[fonts.readingLeading]),
  )
  root.style.setProperty('--font-code', stacks.code)
  root.style.setProperty('--font-code-size', `${fonts.codeSize}px`)
  root.style.setProperty('--font-code-leading', String(codeLeadingScale[fonts.codeLeading]))
  root.style.setProperty(
    '--font-code-ligatures',
    fonts.ligatures ? 'common-ligatures contextual' : 'none',
  )
  root.style.setProperty('--font-code-features', fonts.ligatures ? '"liga" 1, "calt" 1' : 'normal')
  return stacks
}

const probeFaces = [
  ['PingFang SC', false],
  ['Hiragino Sans', false],
  ['Songti SC', false],
  ['Heiti SC', false],
  ['Helvetica Neue', false],
  ['Avenir Next', false],
  ['Georgia', false],
  ['Times New Roman', false],
  ['Arial', false],
  ['SF Mono', true],
  ['Menlo', true],
  ['Monaco', true],
  ['Courier New', true],
  ['JetBrains Mono', true],
  ['Cascadia Code', true],
  ['Cascadia Mono', true],
  ['Fira Code', true],
  ['Source Code Pro', true],
  ['IBM Plex Mono', true],
  ['Hack', true],
  ['Iosevka', true],
  ['Commit Mono', true],
  ['Geist Mono', true],
  ['Berkeley Mono', true],
] as const

async function probeFonts(): Promise<SystemFont[]> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return []
  const checks = await Promise.all(
    probeFaces.map(async ([family, monospace]) => {
      try {
        await new FontFace(`probe-${family}`, `local(${quoteFamily(family)})`).load()
        return { family, monospace }
      } catch {
        return null
      }
    }),
  )
  return checks.flatMap((font) => (font ? [font] : []))
}

function desktopApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function rememberFonts(fonts: SystemFont[]) {
  catalog = fonts
}

export function loadSystemFonts() {
  loading ??= (async () => {
    if (desktopApp()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const fonts = await invoke<SystemFont[]>('system_fonts')
        if (fonts.length) {
          catalog = fonts
          return fonts
        }
      } catch {
        // The page can still offer the faces this browser can already draw.
      }
    }
    const probed = await probeFonts()
    catalog = probed
    return probed
  })()
  return loading
}
