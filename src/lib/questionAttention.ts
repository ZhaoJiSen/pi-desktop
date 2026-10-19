import type { ChatQuestion } from '../components/conversation/QuestionContext'
import type { NotificationPreferences } from './notificationPreferences'

interface AttentionSnapshot {
  questions: ChatQuestion[]
  foreground: boolean
  preferences: NotificationPreferences
}
interface AttentionPorts {
  notify: (question: ChatQuestion, preferences: NotificationPreferences) => Promise<void>
  bounce: () => Promise<void>
  error: (error: unknown) => void
}

// A select→input or queued questionnaire is one interruption, even if Pi briefly
// has no pending request between its two RPC calls.
export class QuestionAttention {
  private batches = new Set<string>()
  private reset: ReturnType<typeof setTimeout> | undefined
  constructor(private ports: AttentionPorts) {}

  sync(snapshot: AttentionSnapshot) {
    clearTimeout(this.reset)
    const pending = snapshot.questions.filter((question) => question.status === 'pending')
    if (!pending.length) {
      this.reset = setTimeout(() => this.batches.clear(), 1000)
      return
    }
    const first = pending[0]!
    const batch = `${first.request.runId || ''}:${first.request.sessionId || ''}`
    if (this.batches.has(batch)) return
    this.batches.add(batch)
    if (snapshot.foreground) return
    if (snapshot.preferences.attention) void this.ports.bounce().catch(this.ports.error)
    if (snapshot.preferences.system)
      void this.ports.notify(first, snapshot.preferences).catch(this.ports.error)
  }

  dispose() {
    clearTimeout(this.reset)
  }
}
