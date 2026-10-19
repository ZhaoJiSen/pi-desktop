import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuestionAttention } from '../../src/lib/questionAttention'
import {
  defaultNotificationPreferences,
  restoreNotificationPreferences,
} from '../../src/lib/notificationPreferences'
import { createWorkspaceStore } from '../../src/store/workspace'
import type { ChatQuestion } from '../../src/components/conversation/QuestionContext'

const question = (id = 'q', status: ChatQuestion['status'] = 'pending'): ChatQuestion => ({
  key: `run:${id}`,
  status,
  receivedAt: 1,
  request: { id, method: 'input', title: 'Question', runId: 'run', sessionId: 'session' },
})
afterEach(() => vi.useRealTimers())
describe('question attention policy', () => {
  const preferences = { ...defaultNotificationPreferences, system: true }
  function setup() {
    const ports = { notify: vi.fn(async () => {}), bounce: vi.fn(async () => {}), error: vi.fn() }
    return { ports, controller: new QuestionAttention(ports) }
  }
  it('never sends system alerts in the foreground or when a previously visible question goes into the background', () => {
    const { controller, ports } = setup()
    controller.sync({ questions: [question()], foreground: true, preferences })
    controller.sync({ questions: [question()], foreground: false, preferences })
    expect(ports.notify).not.toHaveBeenCalled()
    expect(ports.bounce).not.toHaveBeenCalled()
    controller.dispose()
  })
  it('notifies once for a repeated request, queued questions and select→input continuations', () => {
    vi.useFakeTimers()
    const { controller, ports } = setup()
    const sync = (questions: ChatQuestion[]) =>
      controller.sync({ questions, foreground: false, preferences })
    sync([question()])
    sync([question()])
    sync([question(), question('second')])
    sync([])
    vi.advanceTimersByTime(500)
    sync([question('followup')])
    expect(ports.notify).toHaveBeenCalledOnce()
    expect(ports.bounce).toHaveBeenCalledOnce()
    sync([])
    vi.advanceTimersByTime(1000)
    sync([question('new-task')])
    expect(ports.notify).toHaveBeenCalledTimes(2)
    controller.dispose()
  })
  it('honors separate channel switches and ignores resolved or expired requests', () => {
    const { controller, ports } = setup()
    controller.sync({ questions: [question('old', 'expired')], foreground: false, preferences })
    controller.sync({
      questions: [question()],
      foreground: false,
      preferences: { ...preferences, system: false },
    })
    expect(ports.notify).not.toHaveBeenCalled()
    expect(ports.bounce).toHaveBeenCalledOnce()
    controller.dispose()
  })
  it('reports transport failures without repeatedly issuing the same notification', async () => {
    const { controller, ports } = setup()
    ports.notify.mockRejectedValueOnce(new Error('Native transport failed'))
    const snapshot = { questions: [question()], foreground: false, preferences }
    controller.sync(snapshot)
    await Promise.resolve()
    await Promise.resolve()
    controller.sync(snapshot)
    expect(ports.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Native transport failed' }),
    )
    expect(ports.notify).toHaveBeenCalledOnce()
    controller.dispose()
  })
})

describe('notification preference compatibility', () => {
  it('migrates missing and malformed preferences with quiet defaults', () => {
    expect(restoreNotificationPreferences(undefined)).toEqual(defaultNotificationPreferences)
    expect(restoreNotificationPreferences({ system: 'yes', attention: false })).toEqual({
      ...defaultNotificationPreferences,
      attention: false,
    })
  })
  it('reads saved preferences after recreating the workspace', () => {
    let data: string | null = null
    const storage = {
      getItem: () => data,
      setItem: (_name: string, value: string) => {
        data = value
      },
      removeItem: () => {},
    }
    const first = createWorkspaceStore(storage)
    first.getState().setPreference({
      notificationPreferences: { system: true, attention: false, preview: true, sound: false },
    })
    expect(createWorkspaceStore(storage).getState().notificationPreferences).toEqual({
      system: true,
      attention: false,
      preview: true,
      sound: false,
    })
  })
})
