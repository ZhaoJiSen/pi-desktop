import { Button } from '@heroui/react'
import { Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { isDesktop, useWorkspace } from '../store/workspace'
import { readAttachments, sendPrompt } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { errorText } from '../lib/utils'
import { ComposerInput } from './composer/ComposerInput'
import { ComposerToolbar } from './composer/ComposerToolbar'
import { ComposerPrompts } from './composer/ComposerPrompts'
import { ComposerStatus } from './composer/ComposerStatus'
import { ComposerAttachments } from './composer/ComposerAttachments'
import { useComposerCommands } from './composer/useComposerCommands'
import { draftFromText, planDraft, sessionDraft } from '../lib/draft'
import { desktopCommandEnabled } from '../lib/commands'
import { draftProblemMessage } from '../lib/draftMessages'
import { navigateToPage } from '../router/navigation'
import { useComposerCapabilities } from './composer/useComposerCapabilities'
import { CapabilityTags } from './capabilities/CapabilityTags'

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
  const attachments = session?.attachments || []
  const [selector, setSelector] = useState<'model' | 'thinking' | null>(null)
  const [sending, setSending] = useState(false)
  const [reading, setReading] = useState(false)
  const [commandError, setCommandError] = useState('')
  const catalog = useComposerCommands()
  const capability = useComposerCapabilities(catalog.commands)
  const fileInput = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const [focusVersion, setFocusVersion] = useState(0)
  const reducedMotion = useReducedMotion()
  const composer = useRef<HTMLFormElement>(null)
  const [menuBoundary, setMenuBoundary] = useState<HTMLElement | undefined>()
  const setComposer = useCallback((element: HTMLFormElement | null) => {
    composer.current = element
    setMenuBoundary(element?.closest<HTMLElement>('.main') ?? undefined)
  }, [])
  const t = useT()
  if (!session) return null
  const preparing = !running && (sending || reading || connecting || capability.pending)
  const menuPlacement = session.messages.length === 0 ? 'bottom start' : 'top start'
  const navigationOnly =
    planDraft(sessionDraft(session), catalog.commands, attachments.length).kind === 'navigate'
  async function submit() {
    if (sending || reading || running || connecting || capability.pending) return
    const leading = /^\s*\/([\w:.-]+)(?:\s+([\s\S]*))?$/.exec(session!.draft)
    if (leading) {
      const matching = capability.capabilities.filter((c) => c.alias === leading[1])
      const native = catalog.commands.find((c) => c.source === 'builtin' && c.name === leading[1])
      if (
        (matching.length && matching.every((c) => !c.enabled)) ||
        (native && !desktopCommandEnabled(native))
      ) {
        setCommandError(t('library.disabledError'))
        return
      }
      if (matching.length && matching.every(capability.unavailable)) {
        setCommandError(capability.unavailableReason(matching[0]!))
        return
      }
      const matches = matching.filter((c) => c.enabled && !capability.unavailable(c))
      if (matches.length === 1) {
        if (await capability.select(matches[0]!)) {
          update(session!.id, { draftNodes: draftFromText(leading[2] || '', catalog.commands) })
          setFocusVersion((version) => version + 1)
        }
        return
      }
    }
    const plan = planDraft(sessionDraft(session!), catalog.commands, attachments.length)
    if (plan.kind === 'error') {
      setCommandError(draftProblemMessage(plan, t))
      return
    }
    setCommandError('')
    if (plan.kind === 'navigate') {
      if (plan.name === 'model' || plan.name === 'thinking') {
        setSelector(plan.name)
      } else await navigateToPage(plan.name === 'settings' ? 'settings' : 'usage')
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
  return (
    <motion.form
      ref={setComposer}
      className="composer"
      initial={reducedMotion ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        if (!running && !reading && !sending) void attach(event.dataTransfer.files)
      }}
    >
      <ComposerPrompts
        disabled={running || preparing}
        capabilities={capability.capabilities}
        selection={capability.selection}
        unavailable={capability.unavailable}
        unavailableReason={capability.unavailableReason}
        onSelect={capability.select}
      />
      <div className="composer-shell">
        <ComposerAttachments
          files={attachments}
          disabled={running || sending}
          onRemove={(id) =>
            update(session.id, { attachments: attachments.filter((file) => file.id !== id) })
          }
        />
        <Button
          isIconOnly
          variant="ghost"
          className="attach"
          aria-label={t('attachments.add')}
          isDisabled={running || reading || sending}
          onPress={() => fileInput.current?.click()}
        >
          <Plus />
        </Button>
        <ComposerInput
          value={sessionDraft(session)}
          {...catalog}
          commands={capability.slashCommands}
          onSelectCapability={async (id) => {
            if (running || preparing) return false
            const item = capability.capabilities.find((c) => c.id === id)
            return item ? capability.select(item) : false
          }}
          inputRef={input}
          anchorRef={composer}
          placement={menuPlacement}
          boundaryElement={menuBoundary}
          focusVersion={focusVersion}
          onChange={(draftNodes) => {
            update(session.id, { draftNodes })
            setCommandError('')
          }}
          onSubmit={() => void submit()}
        />
        <CapabilityTags
          selection={capability.selection}
          disabled={running || preparing}
          onRemove={(item) => {
            void capability.select(item, true)
          }}
          onArguments={capability.argumentsChanged}
        />
        <ComposerToolbar
          running={running}
          preparing={preparing}
          sendDisabled={
            !running &&
            (preparing ||
              (!session.draft.trim() && !attachments.length && !capability.selection.task) ||
              (isDesktop && !model && !navigationOnly))
          }
          selector={selector}
          setSelector={setSelector}
          placement={menuPlacement}
          boundaryElement={menuBoundary}
        />
      </div>
      {(commandError || capability.error) && (
        <p className="composer-command-error" role="alert">
          {commandError || capability.error}
        </p>
      )}
      <ComposerStatus project={project} usage={session.usage} />
      <input
        ref={fileInput}
        type="file"
        className="sr-only"
        multiple
        tabIndex={-1}
        accept="image/png,image/jpeg,image/webp,image/gif,text/*,.md,.json,.csv,.log,.ts,.tsx,.js,.jsx,.rs,.py,.go,.toml,.yaml,.yml,.css,.html,.sh"
        onChange={(event) => {
          if (event.target.files) void attach(event.target.files)
        }}
      />
    </motion.form>
  )
}
