import type { Message, Session } from '../types'
import { messageText } from './utils'

const textCache = new WeakMap<Message, string>()

export function searchSessions(sessions: Session[], query: string, fallbackTitle: string) {
  const search = query.trim().toLowerCase()
  return sessions
    .filter((session) => {
      if (!search || (session.title || fallbackTitle).toLowerCase().includes(search)) return true
      // Reuse unchanged history across searches and stream updates. Don't build a
      // second giant string containing every session on each keystroke.
      return session.messages.some((message) => {
        let text = textCache.get(message)
        if (text === undefined) {
          text = messageText(message.blocks).toLowerCase()
          textCache.set(message, text)
        }
        return text.includes(search)
      })
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
}
