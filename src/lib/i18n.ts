import { useWorkspace } from '../store/workspace'
import { translate, type MessageKey, type TranslationArgs, type Translator } from './locale'

// For command handlers and other code outside React.
export function t<K extends MessageKey>(key: K, ...args: TranslationArgs<K>) {
  return translate(key, useWorkspace.getState().language, ...args)
}

export function useT(): Translator {
  const language = useWorkspace((state) => state.language)
  return <K extends MessageKey>(key: K, ...args: TranslationArgs<K>) =>
    translate(key, language, ...args)
}
