import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { languageFromLocale, messages, translate, type TranslationArgs } from './locale'

describe('language resolution', () => {
  it.each(['zh', 'zh-CN', 'zh-Hant-TW', 'zh_HK.UTF-8', 'ZH-sg', ' zh-MO '])('uses Chinese for %s', locale => {
    expect(languageFromLocale(locale)).toBe('zh')
  })
  it.each([undefined, null, '', 'en', 'en-US', 'ja-JP', 'fr-FR', 'C', 'C.UTF-8', 'zhuang', 'zhong'])('defaults to English for %s', locale => {
    expect(languageFromLocale(locale)).toBe('en')
  })
  it('interpolates filenames, shortcuts and singular/plural counts as complete messages', () => {
    expect(translate('attachments.remove', 'en', { file: '中文.md' })).toBe('Remove 中文.md')
    expect(translate('attachments.remove', 'zh', { file: 'notes.md' })).toBe('移除 notes.md')
    expect(translate('composer.sendHint', 'en', { shortcut: '⌘ ↵' })).toBe('⌘ ↵ Send')
    expect(translate('projects.sessionCount.one', 'en', { count: 1 })).toBe('1 conversation')
    expect(translate('projects.sessionCount.other', 'en', { count: 0 })).toBe('0 conversations')
    expect(translate('projects.sessionCount.other', 'zh', { count: 2 })).toBe('2 个会话')
  })
  it('keeps both catalogs complete with matching interpolation parameters', () => {
    expect(Object.keys(messages.zh).sort()).toEqual(Object.keys(messages.en).sort())
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
    for (const key of Object.keys(messages.en) as (keyof typeof messages.en)[]) {
      expect(key).toMatch(/^[a-z][A-Za-z]*(\.[a-z][A-Za-z]*)+$/)
      expect(messages.zh[key]).not.toBe('')
      expect(messages.en[key]).not.toBe('')
      expect(placeholders(messages.zh[key]), key).toEqual(placeholders(messages.en[key]))
    }
  })
  it('requires the parameters declared by each message', () => {
    expectTypeOf<TranslationArgs<'attachments.remove'>>().toEqualTypeOf<[values: { file: string | number }]>()
    expectTypeOf<TranslationArgs<'composer.sendHint'>>().toEqualTypeOf<[values: { shortcut: string | number }]>()
    const invalidCallsForTypecheck = () => {
      // @ts-expect-error Chinese text cannot be a translation key.
      translate('正在连接 pi…', 'en')
      // @ts-expect-error Unknown keys cannot compile.
      translate('connection.missing', 'en')
      // @ts-expect-error The file parameter is required.
      translate('attachments.remove', 'en')
      // @ts-expect-error Misspelled interpolation parameters cannot compile.
      translate('composer.sendHint', 'en', { shortuct: '⌘ ↵' })
    }
    // Do not execute deliberately invalid calls; tsc checks the expected errors.
    expect(invalidCallsForTypecheck).toBeTypeOf('function')
  })
  it('rejects unknown keys, Chinese keys and untranslated UI literals', () => {
    const root = fileURLToPath(new URL('../', import.meta.url))
    const missing = new Set<string>()
    let checked = 0
    for (const relative of readdirSync(root, { recursive: true }) as string[]) {
      if (!/\.tsx?$/.test(relative) || relative.endsWith('.test.ts') || relative.startsWith('locales/')) continue
      const file = ts.createSourceFile(relative, readFileSync(`${root}/${relative}`, 'utf8'), ts.ScriptTarget.Latest, true)
      const collect = (node: ts.Node) => {
        if (ts.isStringLiteral(node)) {
          checked++
          if (!(node.text in messages.en)) missing.add(`${relative}: ${node.text}`)
        }
        if (ts.isConditionalExpression(node)) {
          collect(node.whenTrue)
          collect(node.whenFalse)
        }
      }
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['t', 'translate'].includes(node.expression.text) && node.arguments[0]) collect(node.arguments[0])
        if (relative.startsWith('components/') && (ts.isStringLiteral(node) || ts.isJsxText(node)) && /[\u4e00-\u9fff]/.test(node.text)) missing.add(`${relative}: ${node.text}`)
        ts.forEachChild(node, visit)
      }
      visit(file)
    }
    expect(checked).toBeGreaterThan(70)
    expect([...missing]).toEqual([])
  })
})
