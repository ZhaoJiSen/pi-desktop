import { errorText } from './utils'

export type ActionNotice = { title: string; detail: string }

type NoticeTone = 'warning' | 'success'
const listeners = new Set<(message: string, tone: NoticeTone) => void>()

// A finished action that failed. The session itself is unchanged, so this
// stays out of the connection banner and its Reconnect action.
export function reportActionNotice(error: unknown) {
  const message = errorText(error).trim()
  if (!message) return
  for (const listener of listeners) listener(message, 'warning')
}

export function reportSuccessNotice(message: string) {
  const text = message.trim()
  if (!text) return
  for (const listener of listeners) listener(text, 'success')
}

export function onActionNotice(listener: (message: string, tone: NoticeTone) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// "Could not open the project directory: No such file or directory (os error 2)"
// The clause before the first colon is the product sentence; the rest is the cause.
export function actionNotice(message: string): ActionNotice {
  const text = message.trim()
  const index = text.indexOf(': ')
  if (index <= 0) return { title: text, detail: '' }
  const title = text.slice(0, index)
  const detail = text.slice(index + 2).trim()
  if (!detail || title.length > 72 || /[.。]$/.test(title)) return { title: text, detail: '' }
  return { title, detail }
}
