import { en } from '../locales/en'
import { zh } from '../locales/zh'

export type Language = 'zh' | 'en'

// Only the preferred language matters: a secondary Chinese locale must not
// turn a French/English system into a Chinese interface.
export function languageFromLocale(locale?: string | null): Language {
  return locale?.trim().split(/[-_.@]/)[0].toLowerCase() === 'zh' ? 'zh' : 'en'
}

export function browserLanguage(): Language {
  return languageFromLocale(typeof navigator === 'undefined' ? undefined : navigator.language)
}

export type MessageKey = keyof typeof en
export const messages = { en, zh }

type Placeholders<S extends string> = S extends `${string}{${infer Key}}${infer Rest}` ? Key | Placeholders<Rest> : never
export type TranslationArgs<K extends MessageKey> = [Placeholders<(typeof en)[K]>] extends [never]
  ? [values?: never]
  : [values: Record<Placeholders<(typeof en)[K]>, string | number>]
export type Translator = <K extends MessageKey>(key: K, ...args: TranslationArgs<K>) => string

export function translate<K extends MessageKey>(key: K, language: Language, ...args: TranslationArgs<K>): string {
  const template: string = messages[language][key]
  const values = args[0] as Record<string, string | number> | undefined
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values?.[name] ?? placeholder))
}
