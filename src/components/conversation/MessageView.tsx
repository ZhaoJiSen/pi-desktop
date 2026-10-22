import { Brain, Paperclip, TriangleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import type { Message, MessageBlock, ToolBlock } from '../../types'
import { Tool, ToolGroup, toolStartsOpen } from './ToolCall'
import { ReplyContent } from './ReplyContent'
import { CapabilityIcon } from '../capabilities/CapabilityIcon'
import { TextShimmer } from '../TextShimmer'
import { ChatDisclosure } from './ChatDisclosure'

// Group only adjacent tool blocks; prose and thinking keep their original order.
function messageParts(blocks: MessageBlock[]) {
  const parts: { key: string; index: number; block: MessageBlock; tools?: ToolBlock[] }[] = []
  blocks.forEach((block, index) => {
    const previous = parts.at(-1)
    if (block.type === 'tool' && previous?.tools) previous.tools.push(block)
    else
      parts.push({
        key: block.type === 'tool' ? block.id : `${block.type}-${index}`,
        index,
        block,
        ...(block.type === 'tool' ? { tools: [block] } : {}),
      })
  })
  return parts
}

export const MessageView = memo(function MessageView({
  message,
  streaming,
}: {
  message: Message
  streaming: boolean
}) {
  const t = useT()
  const [toolChoice, setToolChoice] = useState<Record<string, boolean>>({})
  const toolOpen = useCallback(
    (tool: ToolBlock) => toolChoice[tool.id] ?? toolStartsOpen(tool),
    [toolChoice],
  )
  const onToggleTool = useCallback((id: string, open: boolean) => {
    setToolChoice((current) => ({ ...current, [id]: open }))
  }, [])
  const parts = useMemo(() => messageParts(message.blocks), [message.blocks])
  if (message.role === 'user')
    return (
      <motion.div
        className="user-message"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {!message.blocks.some((block) => block.type === 'text' && block.text.trim()) &&
          !message.attachments?.length && (
            <span className="user-capability-request">
              {message.capabilityLabel && <CapabilityIcon name={message.capabilityLabel.icon} />}
              {message.capabilityLabel?.name || t('conversation.emptyRequest')}
            </span>
          )}
        {message.blocks.map((block, index) =>
          block.type === 'text' ? <div key={index}>{block.text}</div> : null,
        )}
        {message.attachments?.map((file) => (
          <div key={file} className="user-attachment">
            <Paperclip />
            {file}
          </div>
        ))}
      </motion.div>
    )
  return (
    <motion.article
      className="assistant"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {parts.map(({ block, index, tools, key }) => {
        if (tools && tools.length > 1)
          return <ToolGroup key={key} tools={tools} toolOpen={toolOpen} onToggle={onToggleTool} />
        if (block.type === 'tool')
          return (
            <Tool key={block.id} tool={block} expanded={toolOpen(block)} onToggle={onToggleTool} />
          )
        const live = streaming && index === message.blocks.length - 1
        if (block.type === 'thinking')
          return block.text ? (
            <ChatDisclosure
              className="thinking-block"
              triggerClassName="thinking-trigger"
              key={`thinking-${index}`}
              leadingIndicator
              label={
                <>
                  <Brain className="thinking-icon" />
                  <TextShimmer active={live}>{t('conversation.thinking')}</TextShimmer>
                </>
              }
            >
              <div className="reply-text thinking-text">
                <ReplyContent text={block.text} streaming={live} />
              </div>
            </ChatDisclosure>
          ) : null
        return block.text ? (
          <div className={`reply-text${live ? ' is-streaming' : ''}`} key={`text-${index}`}>
            <ReplyContent text={block.text} streaming={live} />
          </div>
        ) : null
      })}
      {message.error && (
        <div className="message-error" role="alert">
          <TriangleAlert />
          {message.error}
        </div>
      )}
    </motion.article>
  )
})
