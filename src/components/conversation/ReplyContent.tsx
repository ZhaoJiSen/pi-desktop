import { Button, ScrollShadow } from '@heroui/react'
import { Check, Copy } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Streamdown, type Components } from 'streamdown'
import { useT } from '../../lib/i18n'
import { errorText } from '../../lib/utils'
import { useWorkspace } from '../../store/workspace'
import { Highlight } from './Highlight'

const markdownComponents: Components = {
  // Keep typography in the project stylesheet, independent of library defaults.
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  p: 'p',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  strong: 'strong',
  em: 'em',
  blockquote: 'blockquote',
  hr: 'hr',
  thead: 'thead',
  tbody: 'tbody',
  tr: 'tr',
  th: 'th',
  td: 'td',
  input: 'input',
  sup: 'sup',
  sub: 'sub',
  code: ({ children, className }) => <code className={className}>{children}</code>,
  table: ({ children }) => (
    <div className="markdown-table">
      <ScrollShadow className="markdown-table-scroll" orientation="horizontal" size={24}>
        <table>{children}</table>
      </ScrollShadow>
    </div>
  ),
  img: ({ alt, src, title }) => <img alt={alt || ''} src={src} title={title} loading="lazy" />,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  pre: ({ children }) => {
    const child = children && typeof children === 'object' && 'props' in children ? children : null
    const props = (child?.props ?? {}) as { className?: string; children?: unknown }
    const language = /language-([\w#+.-]+)/.exec(props.className || '')?.[1] || ''
    const text = codeText(props.children).replace(/\n$/, '')
    return <CodeBlock language={language} text={text} />
  },
}

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

function codeText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(codeText).join('')
  return ''
}
const CodeBlock = memo(function CodeBlock({ language, text }: { language: string; text: string }) {
  return (
    <div className="markdown-code">
      <div className="markdown-code-bar">
        {language ? <span className="markdown-code-lang">{language.toUpperCase()}</span> : <span />}
        <CopyButton text={text} />
      </div>
      <ScrollShadow className="markdown-code-scroll" orientation="horizontal" size={32}>
        <pre tabIndex={0}>
          <code>
            <Highlight text={text} language={language} />
          </code>
        </pre>
      </ScrollShadow>
    </div>
  )
})

const streamAnimation = { animation: 'fadeIn', duration: 150, easing: 'ease-out' } as const

export const ReplyContent = memo(function ReplyContent({
  text,
  streaming = false,
}: {
  text: string
  streaming?: boolean
}) {
  const reducedMotion = useReducedMotion()
  return (
    <Streamdown
      className="reply-markdown space-y-0"
      mode="streaming"
      components={markdownComponents}
      isAnimating={streaming}
      animated={reducedMotion ? false : streamAnimation}
      caret={streaming ? 'block' : undefined}
      controls={false}
    >
      {text}
    </Streamdown>
  )
})
