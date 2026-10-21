import { Disclosure, Spinner } from '@heroui/react'
import { CircleCheck, CircleX, CirclePause, ChevronDown } from 'lucide-react'
import { memo, useState } from 'react'
import { useT } from '../../lib/i18n'
import type { MessageKey } from '../../lib/locale'
import type { ToolBlock } from '../../types'
import { OpenSourceButton } from '../source/OpenSourceButton'
import { Diff } from './Diff'
import { ToolCode } from './ToolCode'
import { fileLanguage } from './Highlight'
import { TextShimmer } from '../TextShimmer'

function outputLanguage(tool: ToolBlock) {
  if (tool.name !== 'read' || tool.status === 'error') return ''
  const path = tool.args.path ?? tool.args.file_path
  return fileLanguage(typeof path === 'string' ? path : tool.label)
}

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

function ToolStatus({ status }: { status: ToolBlock['status'] }) {
  return status === 'running' ? (
    <Spinner
      className="tool-spinner"
      size="sm"
      color="current"
      aria-hidden="true"
      role="presentation"
    />
  ) : status === 'error' ? (
    <CircleX className="tool-error-icon" aria-hidden="true" />
  ) : status === 'interrupted' ? (
    <CirclePause className="tool-interrupted-icon" aria-hidden="true" />
  ) : (
    <CircleCheck className="check" aria-hidden="true" />
  )
}

export const Tool = memo(function Tool({
  tool,
  expanded,
  onToggle,
}: {
  tool: ToolBlock
  expanded: boolean
  onToggle: (id: string, open: boolean) => void
}) {
  const t = useT()
  const hasArgs = Object.keys(tool.args).length > 0
  return (
    <Disclosure
      className={`chat-disclosure tool-block ${tool.status}`}
      isExpanded={expanded}
      onExpandedChange={(open) => onToggle(tool.id, open)}
    >
      <Disclosure.Heading className="chat-disclosure-heading">
        <Disclosure.Trigger className={`chat-disclosure-trigger tool ${tool.status}`}>
          <ToolStatus status={tool.status} />
          <TextShimmer className="verb" active={tool.status === 'running'}>
            {t(toolVerb(tool))}
          </TextShimmer>
          <span className="filename" title={tool.label}>
            {tool.label}
          </span>
          <Disclosure.Indicator className="tool-chevron">
            <ChevronDown />
          </Disclosure.Indicator>
        </Disclosure.Trigger>
        <OpenSourceButton tool={tool} />
      </Disclosure.Heading>
      <Disclosure.Content>
        <div className="tool-output">
          {hasArgs && (
            <section className="tool-section" aria-label={t('tools.input')}>
              <div className="tool-section-label">{t('tools.input')}</div>
              <ToolCode text={JSON.stringify(tool.args, null, 2)} language="json" />
            </section>
          )}
          <section
            className="tool-section"
            aria-label={t(tool.status === 'error' ? 'tools.errorDetails' : 'tools.output')}
          >
            <div className="tool-section-label">
              {t(tool.status === 'error' ? 'tools.errorDetails' : 'tools.output')}
            </div>
            {tool.diff ? (
              <Diff label={tool.label} lines={tool.diff} />
            ) : tool.output ? (
              <ToolCode text={tool.output} language={outputLanguage(tool)} />
            ) : (
              <div className="tool-pending" role={tool.status === 'running' ? 'status' : undefined}>
                {t(
                  tool.status === 'running'
                    ? 'tools.running'
                    : tool.status === 'error'
                      ? 'tools.noErrorDetails'
                      : tool.status === 'interrupted'
                        ? 'tools.interrupted'
                        : 'tools.noOutput',
                )}
              </div>
            )}
          </section>
        </div>
      </Disclosure.Content>
    </Disclosure>
  )
})

function groupStatus(tools: ToolBlock[]): ToolBlock['status'] {
  if (tools.some((tool) => tool.status === 'running')) return 'running'
  if (tools.some((tool) => tool.status === 'error')) return 'error'
  if (tools.some((tool) => tool.status === 'interrupted')) return 'interrupted'
  return 'done'
}

export const ToolGroup = memo(function ToolGroup({
  tools,
  toolOpen,
  onToggle,
}: {
  tools: ToolBlock[]
  toolOpen: (tool: ToolBlock) => boolean
  onToggle: (id: string, open: boolean) => void
}) {
  const t = useT()
  const status = groupStatus(tools)
  const [expanded, setExpanded] = useState(
    () => status !== 'done' || tools.some((tool) => Boolean(tool.diff)),
  )
  return (
    <Disclosure
      className={`chat-disclosure tool-group ${status}`}
      isExpanded={expanded}
      onExpandedChange={setExpanded}
    >
      <Disclosure.Heading className="chat-disclosure-heading">
        <Disclosure.Trigger className={`chat-disclosure-trigger tool tool-group-trigger ${status}`}>
          <ToolStatus status={status} />
          <span>{t('tools.group', { count: tools.length })}</span>
          <TextShimmer className="tool-group-state" active={status === 'running'}>
            {t(
              status === 'running'
                ? 'tools.running'
                : status === 'error'
                  ? 'tools.failed'
                  : status === 'interrupted'
                    ? 'tools.interrupted'
                    : 'tools.completed',
            )}
          </TextShimmer>
          <Disclosure.Indicator className="tool-chevron">
            <ChevronDown />
          </Disclosure.Indicator>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <div className="tool-group-items">
          {tools.map((tool) => (
            <Tool key={tool.id} tool={tool} expanded={toolOpen(tool)} onToggle={onToggle} />
          ))}
        </div>
      </Disclosure.Content>
    </Disclosure>
  )
})

export function toolStartsOpen(tool: ToolBlock) {
  // A running call stays a single row. Opening it only because it is in
  // progress, then remounting it shut when the turn ends, jumps the thread.
  return Boolean(tool.diff) || tool.status === 'error'
}
