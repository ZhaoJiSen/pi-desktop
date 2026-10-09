import { Button } from '@heroui/react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  LoaderCircle,
  Paperclip,
  TriangleAlert,
} from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import type { MessageKey } from '../lib/locale'
import { errorText } from '../lib/utils'
import type { DiffLine, Message, ToolBlock } from '../types'
import { PiLogo } from './PiLogo'

function PrismToken({ token }: { token: string | Prism.Token }) {
  if (typeof token === 'string') return token
  const content = Array.isArray(token.content) ? token.content : [token.content]
  return (
    <span className={`token ${token.type}`}>
      {content.map((child, i) => (
        <PrismToken key={i} token={child} />
      ))}
    </span>
  )
}

const Highlight = memo(function Highlight({ text }: { text: string }) {
  return (
    <>
      {Prism.tokenize(text, Prism.languages.tsx).map((token, index) => (
        <PrismToken key={index} token={token} />
      ))}
    </>
  )
})

const Diff = memo(function Diff({ label, lines }: { label: string; lines: DiffLine[] }) {
  const t = useT()
  const adds = lines.filter((line) => line.kind === 'add').length
  const removes = lines.filter((line) => line.kind === 'remove').length
  return (
    <div className="diff">
      <div className="diff-header">
        <FileText />
        <span className="diff-file" title={label}>
          {label}
        </span>
        <span className="diff-stats">
          <span className="positive">+{adds}</span>
          {removes > 0 && <span className="negative">−{removes}</span>}
        </span>
        <span className="language">{label.split('.').at(-1)?.toUpperCase()}</span>
      </div>
      <div className="code" tabIndex={0} aria-label={t('tools.codeChanges', { file: label })}>
        {lines.map((line, index) => (
          <div className={`code-line ${line.kind}`} key={index}>
            <span className="line-no">{line.number ?? ''}</span>
            <code className="source">
              <span className="change">
                {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' '}
              </span>
              <Highlight text={line.text} />
            </code>
          </div>
        ))}
      </div>
    </div>
  )
})

type ToolVerbKey = Extract<
  MessageKey,
  `tools.${string}.running` | `tools.${string}.done` | 'tools.failed' | 'tools.interrupted'
>

function toolVerb(tool: ToolBlock): ToolVerbKey {
  if (tool.status === 'error') return 'tools.failed'
  if (tool.status === 'interrupted') return 'tools.interrupted'
  const verbs = (
    {
      read: ['tools.read.running', 'tools.read.done'],
      edit: ['tools.edit.running', 'tools.edit.done'],
      write: ['tools.write.running', 'tools.write.done'],
    } as const
  )[tool.name as 'read' | 'edit' | 'write']
  return verbs
    ? verbs[tool.status === 'running' ? 0 : 1]
    : tool.status === 'running'
      ? 'tools.execute.running'
      : 'tools.execute.done'
}

const Tool = memo(function Tool({ tool }: { tool: ToolBlock }) {
  const [expanded, setExpanded] = useState(
    Boolean(tool.diff) || tool.status === 'running' || tool.status === 'error',
  )
  const t = useT()
  return (
    <div className="tool-block">
      <Button
        variant="ghost"
        className={`tool ${tool.status}`}
        onPress={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={`output-${tool.id}`}
      >
        {expanded ? <ChevronDown className="chevron" /> : <ChevronRight className="chevron" />}
        {tool.status === 'running' ? (
          <LoaderCircle className="spinner" />
        ) : tool.status === 'error' ? (
          <TriangleAlert className="tool-error-icon" />
        ) : (
          <Check className="check" />
        )}
        <span className="verb">{t(toolVerb(tool))}</span>
        <span className="filename" title={tool.label}>
          {tool.label}
        </span>
        {tool.status === 'running' && <span className="status-label">{t('tools.running')}</span>}
      </Button>
      {expanded && (
        <motion.div
          id={`output-${tool.id}`}
          className="tool-output"
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tool.diff ? (
            <Diff label={tool.label} lines={tool.diff} />
          ) : tool.output ? (
            <pre className="tool-text" tabIndex={0}>
              {tool.output}
            </pre>
          ) : (
            <div className="tool-pending">
              {t(tool.status === 'running' ? 'tools.running' : 'tools.interrupted')}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
})

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t = useT()
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current)
    },
    [],
  )
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      timeout.current = setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      useWorkspace.setState({ connectionError: errorText(error) })
    }
  }
  return (
    <Button
      isIconOnly
      variant="ghost"
      className="copy-button"
      aria-label={t(copied ? 'common.copied' : 'common.copy')}
      onPress={() => void copy()}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}

const MessageView = memo(function MessageView({ message }: { message: Message }) {
  const t = useT()
  if (message.role === 'user')
    return (
      <motion.div
        className="user-message"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
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
      {message.blocks.map((block, index) => {
        if (block.type === 'tool') return <Tool key={block.id} tool={block} />
        if (block.type === 'thinking')
          return block.text ? (
            <details className="thinking-block" key={`thinking-${index}`}>
              <summary>{t('conversation.thinking')}</summary>
              <div>{block.text}</div>
            </details>
          ) : null
        return block.text ? (
          <div className="reply-text" key={`text-${index}`}>
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
                pre: ({ children }) => (
                  <div className="markdown-code">
                    <pre tabIndex={0}>{children}</pre>
                    <CopyButton
                      text={
                        typeof children === 'object' && children && 'props' in children
                          ? String((children.props as { children?: string }).children || '')
                          : ''
                      }
                    />
                  </div>
                ),
              }}
            >
              {block.text}
            </Markdown>
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

export function Conversation({ onProject }: { onProject: () => void }) {
  const session = useWorkspace((state) =>
    state.sessions.find((item) => item.id === state.activeSessionId),
  )
  const running = useWorkspace(
    (state) => state.runningSessionId === session?.id && Boolean(session),
  )
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
    <motion.div
      className="conversation"
      ref={scroll}
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
            <MessageView key={message.id} message={message} />
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
          <LoaderCircle className="spinner" />
          {t('tools.running')}
        </div>
      )}
    </motion.div>
  )
}
