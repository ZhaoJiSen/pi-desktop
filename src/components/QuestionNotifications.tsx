import { Button } from '@heroui/react'
import { ArrowRight, MessageCircleQuestion } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useEffectEvent, useRef } from 'react'
import { isDesktop, useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { useCurrentPage } from '../router/hooks'
import { navigateToPage } from '../router/navigation'
import { useAppForeground } from '../hooks/useAppForeground'
import { useQuestions } from './conversation/QuestionContext'
import { QuestionAttention } from '../lib/questionAttention'
import type { ChatQuestion } from './conversation/QuestionContext'
import type { NotificationPreferences } from '../lib/notificationPreferences'
import {
  focusApplication,
  listenNotificationActions,
  requestQuestionAttention,
  showQuestionNotification,
  reportNotificationError,
} from '../lib/notifications'

export function QuestionNotifications() {
  const { questions, focusQuestion } = useQuestions()
  const preferences = useWorkspace((state) => state.notificationPreferences)
  const active = useWorkspace((state) => state.activeSessionId)
  const view = useCurrentPage()
  const foreground = useAppForeground()
  const reduced = useReducedMotion()
  const t = useT()
  const attention = useRef<QuestionAttention | null>(null)
  async function openQuestion(key: string) {
    const question = questions.find((item) => item.key === key)
    if (!question) return
    const sessionId = question.request.sessionId
    const store = useWorkspace.getState()
    if (sessionId && sessionId !== store.activeSessionId) {
      if (store.runningSessionId && store.runningSessionId !== sessionId) return
      if (store.connection === 'connecting') return
      if (!store.sessions.some((item) => item.id === sessionId)) return
      // Viewing a waiting run never changes Pi's execution binding.
      useWorkspace.setState({ activeSessionId: sessionId })
    }
    await focusApplication()
    await navigateToPage('chat')
    focusQuestion(key)
  }
  const openFromNotification = useEffectEvent(openQuestion)
  const relevant = useEffectEvent((key: string, snapshot: NotificationPreferences) => {
    const current = useWorkspace.getState().notificationPreferences
    return (
      !foreground &&
      current.system &&
      current.preview === snapshot.preview &&
      current.sound === snapshot.sound &&
      questions.some((item) => item.key === key && item.status === 'pending')
    )
  })
  const notify = useEffectEvent(
    async (question: ChatQuestion, preferences: NotificationPreferences) => {
      const session = useWorkspace
        .getState()
        .sessions.find((item) => item.id === question.request.sessionId)
      const name = session?.title || t('sessions.new')
      await showQuestionNotification(
        preferences.preview ? question.request.title : t('notification.sessionWaiting', { name }),
        question.key,
        preferences,
        () => relevant(question.key, preferences),
      )
    },
  )
  useEffect(() => {
    let disposed = false
    let stop: (() => Promise<void>) | undefined
    // The listener must exist before a native notification is created.
    const ready = isDesktop
      ? listenNotificationActions((key) => {
          void openFromNotification(key).catch(reportNotificationError)
        }).then((handle) => {
          if (disposed) void handle.unregister()
          else stop = () => handle.unregister()
        })
      : Promise.resolve()
    void ready.catch(reportNotificationError)
    const controller = new QuestionAttention({
      bounce: requestQuestionAttention,
      notify: async (question, preferences) => {
        await ready
        if (!disposed) await notify(question, preferences)
      },
      error: reportNotificationError,
    })
    attention.current = controller
    return () => {
      disposed = true
      controller.dispose()
      attention.current = null
      void stop?.()
    }
  }, [])
  useEffect(() => {
    attention.current?.sync({ questions, foreground, preferences })
  }, [questions, foreground, preferences])
  const pending = questions.find((item) => item.status === 'pending')
  if (
    !pending ||
    !foreground ||
    (view === 'chat' && (!pending.request.sessionId || pending.request.sessionId === active))
  )
    return null
  return (
    <motion.aside
      className="question-attention-notice"
      role="status"
      aria-label={t('notification.needsAnswer')}
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
    >
      <MessageCircleQuestion aria-hidden="true" />
      <span>{t('notification.needsAnswer')}</span>
      <Button
        size="sm"
        variant="secondary"
        onPress={() => {
          void openQuestion(pending.key).catch(reportNotificationError)
        }}
      >
        {t('notification.viewQuestion')}
        <ArrowRight aria-hidden="true" />
      </Button>
    </motion.aside>
  )
}
