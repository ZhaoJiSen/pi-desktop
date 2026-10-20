import { describe, expect, it } from 'vitest'
import {
  applyFonts,
  defaultFonts,
  fontStacks,
  fontsMatchDefault,
  quoteFamily,
  rememberFonts,
  restoreFonts,
} from '../../src/lib/fonts'

describe('font preferences', () => {
  it('keeps a saved family and clamps sizes back into range', () => {
    expect(
      restoreFonts({
        uiFamily: 'Avenir Next',
        uiSize: 40,
        readingSize: 3,
        readingLeading: 'loose',
        codeFamily: 'Bad\nFont',
        codeSize: 13.2,
        codeLeading: 'compact',
        codeFallback: 'PingFang SC',
        ligatures: true,
      }),
    ).toEqual({
      uiFamily: 'Avenir Next',
      uiSize: 16,
      readingSize: 14,
      readingLeading: 'loose',
      codeFamily: null,
      codeSize: 13,
      codeLeading: 'compact',
      codeFallback: 'PingFang SC',
      ligatures: true,
    })
    expect(restoreFonts(null)).toEqual(defaultFonts)
    expect(fontsMatchDefault(defaultFonts)).toBe(true)
  })

  it('drops a missing face once the system catalog is known', () => {
    rememberFonts([
      { family: 'Menlo', monospace: true },
      { family: 'PingFang SC', monospace: false },
    ])
    const stacks = fontStacks({
      ...defaultFonts,
      uiFamily: 'Gone Sans',
      codeFamily: 'Menlo',
      codeFallback: 'PingFang SC',
    })
    expect(stacks.missingUi).toBe(true)
    expect(stacks.ui).not.toContain('Gone Sans')
    expect(stacks.code.startsWith(`${quoteFamily('Menlo')},`)).toBe(true)
    expect(stacks.code).toContain(quoteFamily('PingFang SC'))
    expect(stacks.missingCode).toBe(false)
    rememberFonts([])
  })

  it('writes the reading and code variables', () => {
    const root = { style: new Map<string, string>() }
    applyFonts(
      {
        style: { setProperty: (key: string, value: string) => root.style.set(key, value) },
      } as HTMLElement,
      { ...defaultFonts, readingLeading: 'loose', ligatures: true, codeSize: 16 },
    )
    expect(root.style.get('--font-reading-leading')).toBe('1.95')
    expect(root.style.get('--font-code-size')).toBe('16px')
    expect(root.style.get('--font-code-ligatures')).toBe('common-ligatures contextual')
  })
})
