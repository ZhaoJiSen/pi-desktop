import { en } from '../locales/en'
import { sourceEn, sourceZh } from '../locales/sourceMessages'
import { zh } from '../locales/zh'

export type Language = 'zh' | 'en'

// Only the preferred language matters: a secondary Chinese locale must not
// turn a French/English system into a Chinese interface.
export function languageFromLocale(locale?: string | null): Language {
  return locale
    ?.trim()
    .split(/[-_.@]/)[0]
    .toLowerCase() === 'zh'
    ? 'zh'
    : 'en'
}

export function browserLanguage(): Language {
  return languageFromLocale(typeof navigator === 'undefined' ? undefined : navigator.language)
}

type Catalog = typeof en & typeof sourceEn
export type MessageKey = keyof Catalog
export const messages = {
  en: { ...en, ...sourceEn },
  zh: { ...zh, ...sourceZh },
} as { en: Record<MessageKey, string>; zh: Record<MessageKey, string> }

type EnText<K extends MessageKey> = K extends keyof typeof sourceEn
  ? (typeof sourceEn)[K]
  : K extends keyof typeof en
    ? (typeof en)[K]
    : never

type Placeholders<S extends string> = S extends `${string}{${infer Key}}${infer Rest}`
  ? Key | Placeholders<Rest>
  : never
export type TranslationArgs<K extends MessageKey> = [Placeholders<EnText<K>>] extends [never]
  ? [values?: never]
  : [values: Record<Placeholders<EnText<K>>, string | number>]
export type Translator = <K extends MessageKey>(key: K, ...args: TranslationArgs<K>) => string

export function translate<K extends MessageKey>(
  key: K,
  language: Language,
  ...args: TranslationArgs<K>
): string {
  const template: string = messages[language][key]
  const values = args[0] as Record<string, string | number> | undefined
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    String(values?.[name] ?? placeholder),
  )
}
