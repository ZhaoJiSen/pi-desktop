import { Button, Popover } from '@heroui/react'
import { ArrowUp, Brain, Check, ChevronDown, GitBranch, Paperclip, Square, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { isDesktop, useWorkspace } from '../store/workspace'
import { abortPrompt, changeThinking, readAttachments, sendPrompt } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { cost, errorText, tokens } from '../lib/utils'
import type { MessageKey } from '../lib/locale'
import type { ThinkingLevel } from '../types'
import { ModelSelector } from './ModelSelector'
import { DraftEditor } from './composer/DraftEditor'
import { useComposerCommands } from './composer/useComposerCommands'
import { planDraft, sessionDraft } from '../lib/draft'
import { draftProblemMessage } from '../lib/draftMessages'
import { navigateToPage } from '../router/navigation'

const thinkingLabel = {
  off: 'thinking.off',
  minimal: 'thinking.minimal',
  low: 'thinking.low',
  medium: 'thinking.medium',
  high: 'thinking.high',
  xhigh: 'thinking.xhigh',
  max: 'thinking.max',
} as const satisfies Record<ThinkingLevel, MessageKey>

export function Composer() {
  const active = useWorkspace((state) => state.activeSessionId)
  return active ? <SessionComposer key={active} /> : null
}
function SessionComposer() {
  const session = useWorkspace((state) =>
    state.sessions.find((item) => item.id === state.activeSessionId),
  )
  const project = useWorkspace((state) =>
    state.projects.find((item) => item.id === session?.projectId),
  )
  const update = useWorkspace((state) => state.updateSession)
  const running = useWorkspace(
    (state) => state.runningSessionId === session?.id && Boolean(session),
  )
  const connecting = useWorkspace((state) => state.connection === 'connecting')
  const model = useWorkspace((state) =>
    state.models.find((model) => `${model.provider}/${model.id}` === session?.modelKey),
  )
  const levels = useWorkspace((state) => state.thinkingLevels)
  const attachments = session?.attachments || []
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [reading, setReading] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [commandError, setCommandError] = useState('')
  const catalog = useComposerCommands()
  const fileInput = useRef<HTMLInputElement>(null)
  const t = useT()
  if (!session) return null
  const navigationOnly =
    planDraft(sessionDraft(session), catalog.commands, attachments.length).kind === 'navigate'
  async function submit() {
    if (sending || reading || running || connecting) return
    const plan = planDraft(sessionDraft(session!), catalog.commands, attachments.length)
    if (plan.kind === 'error') {
      setCommandError(draftProblemMessage(plan, t))
      return
    }
    setCommandError('')
    if (plan.kind === 'navigate') {
      if (plan.name === 'model') setModelOpen(true)
      else if (plan.name === 'thinking') setThinkingOpen(true)
      else await navigateToPage(plan.name === 'settings' ? 'settings' : 'usage')
      update(session!.id, { draftNodes: [] })
      return
    }
    setSending(true)
    try {
      if (await sendPrompt(attachments)) update(session!.id, { attachments: [] })
    } finally {
      setSending(false)
    }
  }
  async function attach(files: FileList | File[]) {
    setReading(true)
    try {
      const added = await readAttachments(files)
      if (attachments.length + added.length > 8) throw new Error(t('errors.attachmentLimit'))
      update(session!.id, { attachments: [...attachments, ...added] })
    } catch (error) {
      useWorkspace.setState({ connectionError: errorText(error) })
    } finally {
      setReading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }
  async function selectThinking(level: ThinkingLevel) {
    try {
      await changeThinking(level)
      setThinkingOpen(false)
    } catch (error) {
      useWorkspace.setState({ connectionError: errorText(error) })
    }
  }
  return (
    <motion.form
      className="composer"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        if (!running) void attach(event.dataTransfer.files)
      }}
    >
      <div className="metadata" aria-label={t('composer.status')}>
        {project?.branch && (
          <>
            <GitBranch />
            <span className="value">{project.branch}</span>
            <span className="dot">·</span>
          </>
        )}
        <span>
          {t('usage.context')}{' '}
          <span className="value">
            {session.usage.contextPercent === null
              ? '—'
              : `${Math.round(session.usage.contextPercent)}%`}
          </span>
        </span>
        <span className="dot optional-token">·</span>
        <span className="optional-token">
          <span className="value">{tokens(session.usage.total)}</span> {t('usage.tokenUnit')}
        </span>
        <span className="dot">·</span>
        <span>
          {t('usage.estimate')} <span className="value">{cost(session.usage.cost)}</span>
        </span>
      </div>
      {attachments.length > 0 && (
        <div className="attachments">
          {attachments.map((file) => (
            <div key={file.id} className="attachment">
              <Paperclip />
              <span title={file.name}>{file.name}</span>
              <Button
                isIconOnly
                variant="ghost"
                aria-label={t('attachments.remove', { file: file.name })}
                className="attachment-remove"
                isDisabled={running || sending}
                onPress={() =>
                  update(session.id, {
                    attachments: attachments.filter((item) => item.id !== file.id),
                  })
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}
      <DraftEditor
        key={session.id}
        value={sessionDraft(session)}
        {...catalog}
        onChange={(draftNodes) => {
          update(session.id, { draftNodes })
          setCommandError('')
        }}
        onSubmit={() => void submit()}
      />
      {commandError && (
        <p className="composer-command-error" role="alert">
          {commandError}
        </p>
      )}
      <div className="composer-toolbar">
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,text/*,.md,.json,.csv,.log,.ts,.tsx,.js,.jsx,.rs,.py,.go,.toml,.yaml,.yml,.css,.html,.sh"
          onChange={(event) => {
            if (event.target.files) void attach(event.target.files)
          }}
          tabIndex={-1}
        />
        <Button
          isIconOnly
          variant="ghost"
          className="attach"
          aria-label={t('attachments.add')}
          isDisabled={running || reading || sending}
          onPress={() => fileInput.current?.click()}
        >
          <Paperclip />
        </Button>
        <ModelSelector isOpen={modelOpen} onOpenChange={setModelOpen} />
        <Popover isOpen={thinkingOpen} onOpenChange={setThinkingOpen}>
          <Button
            variant="ghost"
            className="composer-select reasoning"
            aria-label={t('thinking.effort')}
            isDisabled={running || connecting || !model?.reasoning}
          >
            <Brain />
            <span>{t(thinkingLabel[session.thinking])}</span>
            <ChevronDown className="chevron" />
          </Button>
          <Popover.Content placement="top start" className="thinking-popover" offset={12}>
            <Popover.Dialog aria-label={t('thinking.effort')}>
              {levels.map((level) => (
                <Button
                  key={level}
                  variant="ghost"
                  className="menu-row"
                  onPress={() => void selectThinking(level)}
                  aria-pressed={level === session.thinking}
                >
                  <span>{t(thinkingLabel[level])}</span>
                  {level === session.thinking && <Check />}
                </Button>
              ))}
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
        <div className="send-area">
          <span className="send-hint">{t('composer.sendHint', { shortcut: '⌘ ↵' })}</span>
          <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.08 }}>
            <Button
              type={running ? 'button' : 'submit'}
              isIconOnly
              className="send"
              aria-label={t(running ? 'composer.stop' : 'composer.send')}
              isDisabled={
                !running &&
                (sending ||
                  reading ||
                  connecting ||
                  (!session.draft.trim() && !attachments.length) ||
                  (isDesktop && !model && !navigationOnly))
              }
              onPress={running ? () => void abortPrompt() : undefined}
            >
              {running ? <Square className="stop-icon" /> : <ArrowUp />}
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.form>
  )
}
