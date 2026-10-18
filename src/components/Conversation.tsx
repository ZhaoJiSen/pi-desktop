import { Button, ScrollShadow, Spinner } from '@heroui/react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import type { ToolBlock } from '../types'
import { PiLogo } from './PiLogo'
import { TextShimmer } from './TextShimmer'
import { MessageView } from './conversation/MessageView'
import { toolStartsOpen } from './conversation/ToolCall'

const MotionScrollShadow = motion.create(ScrollShadow)

export function Conversation({ onProject }: { onProject: () => void }) {
  const session = useWorkspace((state) =>
    state.sessions.find((item) => item.id === state.activeSessionId),
  )
  const running = useWorkspace(
    (state) => state.runningSessionId === session?.id && Boolean(session),
  )
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
  useEffect(() => {
    const element = scroll.current
    if (element && nearBottom.current) element.scrollTop = element.scrollHeight
  }, [session?.messages])
  useEffect(() => {
    nearBottom.current = true
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [session?.id])
  return (
    <MotionScrollShadow
      className={wrapLines ? 'conversation is-wrap' : 'conversation'}
      ref={scroll}
      orientation="vertical"
      size={24}
      isEnabled={Boolean(session?.messages.length)}
      visibility={session?.messages.length ? 'auto' : 'none'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      onScroll={() => {
        const element = scroll.current
        if (element)
          nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100
      }}
    >
      {session?.messages.length ? (
        <div className="conversation-content">
          {session.messages.map((message) => (
            <MessageView
              key={message.id}
              message={message}
              streaming={
                running &&
                message.role === 'assistant' &&
                message.id === session.messages.at(-1)?.id
              }
              toolOpen={toolOpen}
              onToggleTool={onToggleTool}
            />
          ))}
        </div>
      ) : (
        <div className="empty-conversation">
          {session ? (
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
      {running && (
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
