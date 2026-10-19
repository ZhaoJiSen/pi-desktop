import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { extensionResponse, onExtensionRequest } from '../../lib/desktop'
import { runtimeState } from '../../lib/desktop/runtimeState'
import { errorText } from '../../lib/utils'
import { useWorkspace } from '../../store/workspace'
import type { ExtensionRequest } from '../../types'

export interface ChatQuestion {
  key: string
  request: ExtensionRequest
  receivedAt: number
  status: 'pending' | 'answered' | 'cancelled' | 'expired' | 'unavailable'
  answer?: string
  error?: string
  sending?: boolean
  value?: string
  selected?: number
}
const Context = createContext<{
  questions: ChatQuestion[]
  focusRequest: { key: string } | null
  focusQuestion: (key: string) => void
  updateDraft: (key: string, patch: Pick<ChatQuestion, 'value' | 'selected'>) => void
  respond: (
    question: ChatQuestion,
    payload: Record<string, unknown>,
    answer?: string,
  ) => Promise<void>
}>({
  questions: [],
  focusRequest: null,
  focusQuestion: () => {},
  updateDraft: () => {},
  respond: async () => {},
})

export function QuestionProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<ChatQuestion[]>([])
  const [focusRequest, setFocusRequest] = useState<{ key: string } | null>(null)
  const focusQuestion = useCallback((key: string) => setFocusRequest({ key }), [])
  const inFlight = useRef(new Set<string>())
  const update = useCallback((key: string, patch: Partial<ChatQuestion>) => {
    setQuestions((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }, [])
  useEffect(
    () =>
      onExtensionRequest((request) => {
        const key = `${request.runId || ''}:${request.id}`
        setQuestions((items) =>
          items.some((item) => item.key === key)
            ? items
            : [
                ...items,
                {
                  key,
                  request,
                  receivedAt: Date.now(),
                  status: 'pending',
                  value: request.prefill || '',
                },
              ],
        )
      }),
    [],
  )
  useEffect(
    () =>
      useWorkspace.subscribe(() => {
        setQuestions((items) => {
          const stale = items.some(
            (item) =>
              item.status === 'pending' &&
              item.request.runId &&
              (item.request.runId !== runtimeState.currentRun?.id ||
                Boolean(
                  item.request.sessionId &&
                  item.request.sessionId !== runtimeState.currentRun?.sessionId,
                )),
          )
          return stale
            ? items.map((item) =>
                item.status === 'pending' &&
                item.request.runId &&
                (item.request.runId !== runtimeState.currentRun?.id ||
                  Boolean(
                    item.request.sessionId &&
                    item.request.sessionId !== runtimeState.currentRun?.sessionId,
                  ))
                  ? { ...item, status: 'unavailable', sending: false }
                  : item,
              )
            : items
        })
      }),
    [],
  )
  const respond = useCallback(
    async (question: ChatQuestion, payload: Record<string, unknown>, answer?: string) => {
      if (question.status !== 'pending' || inFlight.current.has(question.key)) return
      inFlight.current.add(question.key)
      update(question.key, { sending: true, error: '' })
      try {
        await extensionResponse(
          question.request.id,
          payload,
          question.request.runId,
          question.request.sessionId,
        )
        update(question.key, {
          status: payload.cancelled || payload.confirmed === false ? 'cancelled' : 'answered',
          answer,
          sending: false,
        })
      } catch (error) {
        update(question.key, { error: errorText(error), sending: false })
      } finally {
        inFlight.current.delete(question.key)
      }
    },
    [update],
  )
  useEffect(() => {
    const timers = questions
      .filter((item) => item.status === 'pending' && item.request.timeout && !item.sending)
      .map((item) =>
        setTimeout(
          () => {
            update(item.key, { status: 'expired', sending: false })
            void extensionResponse(
              item.request.id,
              { cancelled: true },
              item.request.runId,
              item.request.sessionId,
            ).catch(() => {})
          },
          Math.max(0, item.receivedAt + item.request.timeout! - Date.now()),
        ),
      )
    return () => timers.forEach(clearTimeout)
  }, [questions, update])
  return (
    <Context.Provider
      value={{ questions, respond, updateDraft: update, focusRequest, focusQuestion }}
    >
      {children}
    </Context.Provider>
  )
}

export function useQuestions() {
  return useContext(Context)
}
