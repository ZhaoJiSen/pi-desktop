import { Button, ScrollShadow, Spinner } from '@heroui/react'
import { motion } from 'motion/react'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import type { Message, ToolBlock } from '../types'
import { PiLogo } from './PiLogo'
import { TextShimmer } from './TextShimmer'
import { MessageView } from './conversation/MessageView'
import { toolStartsOpen } from './conversation/ToolCall'

import { useQuestions } from './conversation/QuestionContext'
import { QuestionCard } from './conversation/QuestionCard'

const MotionScrollShadow = motion.create(ScrollShadow)
const HISTORY_PAGE_SIZE = 80
const EMPTY_MESSAGES: Message[] = []

export function Conversation({ onProject }: { onProject: () => void }) {
  const sessionId = useWorkspace((state) => state.activeSessionId)
  return <SessionConversation key={sessionId} sessionId={sessionId} onProject={onProject} />
}

function SessionConversation({
  sessionId,
  onProject,
}: {
  sessionId: string | null
  onProject: () => void
}) {
  const messages = useWorkspace(
    (state) => state.sessions.find((item) => item.id === sessionId)?.messages ?? EMPTY_MESSAGES,
  )
  const running = useWorkspace(
    (state) => state.runningSessionId === sessionId && Boolean(sessionId),
  )
  // Open the current part of a long thread without parsing years of Markdown.
  // Keep the start fixed while new messages arrive so reading history is stable.
  const [historyStart, setHistoryStart] = useState<number | null>(null)
  const latestStart = Math.max(0, messages.length - HISTORY_PAGE_SIZE)
  const start = Math.min(historyStart ?? latestStart, latestStart)
  const prependAnchor = useRef<number | null>(null)
  const { questions } = useQuestions()
  const visibleQuestions = useMemo(
    () =>
      questions.filter(
        (item) =>
          item.request.sessionId === sessionId ||
          (!item.request.sessionId && item.status === 'pending'),
      ),
    [questions, sessionId],
  )
  const anchoredQuestions = useMemo(() => {
    const result = new Map<string | undefined, typeof visibleQuestions>()
    if (!visibleQuestions.length) return result
    const ids = new Set(messages.slice(start).map((message) => message.id))
    for (const item of visibleQuestions) {
      const anchor = item.request.afterMessageId
      const key = anchor && ids.has(anchor) ? anchor : undefined
      const group = result.get(key) ?? []
      group.push(item)
      result.set(key, group)
    }
    return result
  }, [messages, start, visibleQuestions])
  const awaitingAnswer = visibleQuestions.some((item) => item.status === 'pending')
  const pendingKey = questions.find((item) => item.status === 'pending')?.key
  const questionCards = (after?: string) =>
    anchoredQuestions
      .get(after)
      ?.map((item) => (
        <QuestionCard key={item.key} question={item} queued={item.key !== pendingKey} />
      ))
  const wrapLines = useWorkspace((state) => state.wrapLines)
  const [toolChoice, setToolChoice] = useState<Record<string, boolean>>({})
  const toolOpen = useCallback(
    (tool: ToolBlock) => {
      return tool.id in toolChoice ? toolChoice[tool.id]! : toolStartsOpen(tool)
    },
    [toolChoice],
  )
  const onToggleTool = useCallback((id: string, open: boolean) => {
    setToolChoice((current) => ({ ...current, [id]: open }))
  }, [])
  const scroll = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const t = useT()
  useLayoutEffect(() => {
    const element = scroll.current
    if (element && prependAnchor.current !== null) {
      element.scrollTop = element.scrollHeight - prependAnchor.current
      prependAnchor.current = null
    }
  }, [start])
  useEffect(() => {
    const element = scroll.current
    if (element && nearBottom.current) element.scrollTop = element.scrollHeight
  }, [messages, questions])
  useEffect(() => {
    nearBottom.current = true
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [sessionId])
  return (
    <MotionScrollShadow
      className={wrapLines ? 'conversation is-wrap' : 'conversation'}
      ref={scroll}
      orientation="vertical"
      size={24}
      isEnabled={Boolean(messages.length || visibleQuestions.length)}
      visibility={messages.length || visibleQuestions.length ? 'auto' : 'none'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      onScroll={() => {
        const element = scroll.current
        if (element) {
          nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100
          if (!nearBottom.current && historyStart === null) setHistoryStart(start)
        }
      }}
    >
      {messages.length || visibleQuestions.length ? (
        <div className="conversation-content">
          {start > 0 && (
            <div className="conversation-history">
              <Button
                variant="ghost"
                onPress={() => {
                  const element = scroll.current
                  if (element) prependAnchor.current = element.scrollHeight - element.scrollTop
                  nearBottom.current = false
                  setHistoryStart(Math.max(0, start - HISTORY_PAGE_SIZE))
                }}
              >
                {t('conversation.loadEarlier')}
              </Button>
            </div>
          )}
          {questionCards()}
          {messages.slice(start).map((message) => (
            <Fragment key={message.id}>
              <MessageView
                message={message}
                streaming={
                  running &&
                  !awaitingAnswer &&
                  message.role === 'assistant' &&
                  message.id === messages.at(-1)?.id
                }
                toolOpen={toolOpen}
                onToggleTool={onToggleTool}
              />
              {questionCards(message.id)}
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="empty-conversation">
          {sessionId ? (
            <PiLogo />
          ) : (
            <>
              <h2>{t('conversation.chooseProject')}</h2>
              <p>{t('conversation.emptyDescription')}</p>
              <Button variant="secondary" onPress={onProject}>
                {t('projects.openFolder')}
              </Button>
            </>
          )}
        </div>
      )}
      {running && !awaitingAnswer && (
        <div className="run-status" role="status">
          <Spinner
            className="run-spinner"
            size="sm"
            color="current"
            aria-hidden="true"
            role="presentation"
          />
          <TextShimmer>{t('tools.running')}</TextShimmer>
        </div>
      )}
    </MotionScrollShadow>
  )
}
