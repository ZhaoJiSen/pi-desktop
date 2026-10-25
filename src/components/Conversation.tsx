import { Button, ScrollShadow, Spinner } from '@heroui/react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import type { Message } from '../types'
import { PiLogo } from './PiLogo'
import { TextShimmer } from './TextShimmer'
import { MessageView } from './conversation/MessageView'

import { useQuestions } from './conversation/QuestionContext'
import { QuestionCard } from './conversation/QuestionCard'
import { questionAnchorResolver } from '../lib/questionAnchors'

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
  const connecting = useWorkspace((state) => state.connection === 'connecting')
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
          // A switch can wait for confirmation from the previous Pi session.
          // Keep it answerable without changing the selected destination.
          (item.status === 'pending' && (connecting || !item.request.sessionId)),
      ),
    [questions, sessionId, connecting],
  )
  const anchoredQuestions = useMemo(() => {
    const result = new Map<string | undefined, typeof visibleQuestions>()
    if (!visibleQuestions.length) return result
    const resolve = questionAnchorResolver(messages)
    for (const item of visibleQuestions) {
      const index = item.request.sessionId === sessionId ? resolve(item.request) : undefined
      let key: string | undefined
      if (index !== undefined && index >= start) key = messages[index].id
      else if (index === -1 && start === 0) key = undefined
      else if (item.status === 'pending') key = messages.at(-1)?.id
      else continue // Hidden history/removed branch is not the beginning of the conversation.
      const group = result.get(key) ?? []
      group.push(item)
      result.set(key, group)
    }
    return result
  }, [messages, start, visibleQuestions, sessionId])
  const awaitingAnswer = visibleQuestions.some((item) => item.status === 'pending')
  const pendingKey = questions.find((item) => item.status === 'pending')?.key
  const questionCards = (after?: string) =>
    anchoredQuestions
      .get(after)
      ?.map((item) => (
        <QuestionCard key={item.key} question={item} queued={item.key !== pendingKey} />
      ))
  const wrapLines = useWorkspace((state) => state.wrapLines)
  const hasContent = Boolean(messages.length || visibleQuestions.length)
  const scroll = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const savedScroll = useRef<number | null>(null)
  const scrollSize = useRef({ height: 0, viewport: 0 })
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
  useLayoutEffect(() => {
    const element = scroll.current
    if (!element) return
    element.scrollTop = nearBottom.current ? element.scrollHeight : (savedScroll.current ?? 0)
    return () => {
      savedScroll.current = element.scrollTop
    }
  }, [])
  useLayoutEffect(() => {
    const element = scroll.current
    const body = content.current
    if (!element || !body) return
    // Local disclosures, images and wrapping can change height without new messages.
    // Follow only while the reader is already at the bottom; history stays anchored.
    const observer = new ResizeObserver(() => {
      const height = element.scrollHeight
      const viewport = element.clientHeight
      scrollSize.current = { height, viewport }
      if (
        prependAnchor.current === null &&
        (nearBottom.current || height - viewport - element.scrollTop < 100)
      ) {
        nearBottom.current = true
        element.scrollTop = height
      }
    })
    observer.observe(body)
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasContent])
  return (
    <ScrollShadow
      className={wrapLines ? 'conversation is-wrap' : 'conversation'}
      ref={scroll}
      orientation="vertical"
      size={24}
      isEnabled={hasContent}
      visibility={hasContent ? 'auto' : 'none'}
      onWheelCapture={(event) => {
        // Honor an upward reading gesture even if a streamed resize happens
        // before its scroll event reaches the conversation.
        if (event.deltaY < 0 && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          nearBottom.current = false
          if (historyStart === null) setHistoryStart(start)
        }
      }}
      onScroll={() => {
        const element = scroll.current
        if (element) {
          // Delayed scroll events from layout changes must not cancel bottom-follow.
          if (
            element.scrollHeight !== scrollSize.current.height ||
            element.clientHeight !== scrollSize.current.viewport
          )
            return
          nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100
          if (!nearBottom.current && historyStart === null) setHistoryStart(start)
        }
      }}
    >
      {hasContent ? (
        <div className="conversation-content" ref={content}>
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
    </ScrollShadow>
  )
}
