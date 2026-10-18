import type { Attachment, RpcState, SlashCommand } from '../../types'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { errorText } from '../utils'
import { planDraft, sessionDraft } from '../draft'
import { desktopCommandEnabled, loadBuiltinCommands } from '../commands'
import { draftProblemMessage } from '../draftMessages'
import { request, syncSession } from './requests'
import { runtimeState } from './runtimeState'
import { bridgeCall, capabilityError } from '../capabilities/bridge'
import { resolveCapabilities } from '../capabilities/catalog'
import type { CapabilitySubmission } from '../capabilities/types'

export async function sendPrompt(attachments: Attachment[]): Promise<boolean> {
  const store = useWorkspace.getState()
  const session = store.sessions.find((item) => item.id === store.activeSessionId)
  if (!session || store.runningSessionId || store.piUpdating) return false
  if (!isDesktop) {
    useWorkspace.setState({ connectionError: t('errors.sendRequiresDesktop') })
    return false
  }
  if (store.connection !== 'connected' || runtimeState.currentRun?.sessionId !== session.id) {
    useWorkspace.setState({ connectionError: t('errors.notConnected') })
    return false
  }
  let text = session.draft.trim()
  const displayText = text
  const unchanged = () => {
    const current = useWorkspace.getState().sessions.find((item) => item.id === session.id)
    return (
      current?.draft === session.draft &&
      JSON.stringify(current?.draftNodes) === JSON.stringify(session.draftNodes)
    )
  }
  // Desktop visibility controls apply to typed slash commands and already selected tags too.
  const available = resolveCapabilities(store.capabilityPreferences, store.commands, t)
  const leadingName = /^\s*\/([\w:.-]+)(?:\s|$)/.exec(session.draft)?.[1]
  const disabledAlias =
    leadingName &&
    available.some((item) => item.alias === leadingName) &&
    available.filter((item) => item.alias === leadingName).every((item) => !item.enabled)
  const disabledSelection = [session.capabilities?.mode, session.capabilities?.task].some(
    (item) => item && !available.some((current) => current.id === item.id && current.enabled),
  )
  if (disabledAlias || disabledSelection) {
    useWorkspace.setState({ connectionError: t('library.disabledError') })
    return false
  }
  if (leadingName && store.capabilityPreferences.disabledCommandIds?.length) {
    const builtin = await loadBuiltinCommands(store.piExecutable).catch(() => [])
    if (
      builtin.some((command) => command.name === leadingName && !desktopCommandEnabled(command))
    ) {
      useWorkspace.setState({ connectionError: t('library.disabledError') })
      return false
    }
    if (useWorkspace.getState().activeSessionId !== session.id || !unchanged()) return false
  }
  if (session.draftNodes?.some((node) => node.type === 'command')) {
    try {
      const runId = runtimeState.currentRun.id
      const bindingVersion = runtimeState.currentRun.bindingVersion
      // Revalidate against the live runtime so removed/disabled extensions cannot
      // silently degrade into an ordinary model prompt.
      const [runtime, builtin] = await Promise.all([
        request<{ commands: SlashCommand[] }>({ type: 'get_commands' }),
        session.draftNodes.some((node) => node.type === 'command' && node.source === 'builtin')
          ? loadBuiltinCommands(store.piExecutable)
          : Promise.resolve([]),
      ])
      if (
        useWorkspace.getState().activeSessionId !== session.id ||
        useWorkspace.getState().runningSessionId ||
        runtimeState.currentRun?.id !== runId ||
        runtimeState.currentRun.bindingVersion !== bindingVersion
      )
        return false
      useWorkspace.setState({ commands: runtime.commands })
      const plan = planDraft(
        sessionDraft(session),
        [...builtin, ...runtime.commands],
        attachments.length,
      )
      if (plan.kind === 'error') throw new Error(draftProblemMessage(plan, t))
      if (plan.kind === 'navigate') throw new Error(t('commands.desktopAction'))
      if (plan.kind === 'compact') {
        useWorkspace.setState({ runningSessionId: session.id, connectionError: null })
        try {
          await request({
            type: 'compact',
            ...(plan.instructions ? { customInstructions: plan.instructions } : {}),
          })
          if (unchanged()) store.updateSession(session.id, { draftNodes: [] })
          await syncSession(session.id).catch((error) =>
            useWorkspace.setState({ connectionError: errorText(error) }),
          )
          return true
        } finally {
          if (useWorkspace.getState().runningSessionId === session.id)
            useWorkspace.setState({ runningSessionId: null })
        }
      }
      text = plan.message
    } catch (error) {
      useWorkspace.setState({ connectionError: errorText(error) })
      return false
    }
  }
  if (!text && !attachments.length && !session.capabilities?.task) return false
  let submission: CapabilitySubmission | undefined
  const selected = session.capabilities
  if (store.capabilityBridge || selected?.mode || selected?.task || session.pendingCapabilitySend) {
    if (!store.capabilityBridge) {
      useWorkspace.setState({ connectionError: t('capability.bridgeUnavailable') })
      return false
    }
    const attachmentKey = attachments.map((a) => a.id).join(':')
    const retry = session.pendingCapabilitySend
    submission =
      retry?.body === displayText && retry.attachmentKey === attachmentKey
        ? retry
        : {
            id: crypto.randomUUID(),
            body: displayText,
            attachmentKey,
            ...selected,
          }
    store.updateSession(session.id, { pendingCapabilitySend: submission })
    try {
      if (submission.uncertain) {
        const actual = await bridgeCall({ op: 'status' })
        if (!actual.receipts.some((receipt) => receipt.id === submission!.id))
          throw new Error('capability.uncertain')
      }
      const prepared = await bridgeCall({ op: 'prepare', submission })
      if (prepared.accepted) {
        store.updateSession(session.id, {
          ...(unchanged() ? { draftNodes: [] } : {}),
          capabilities: { mode: prepared.mode },
          pendingCapabilitySend: undefined,
        })
        await syncSession(session.id)
        return true
      }
      if (submission.task?.target) {
        if (attachments.length && submission.task.target.source === 'extension')
          throw new Error('capability.commandAttachments')
        text =
          `/${submission.task.target.name} ${[submission.task.arguments, displayText].filter(Boolean).join(' ')}`.trim()
      }
    } catch (error) {
      useWorkspace.setState({ connectionError: capabilityError(error) })
      return false
    }
  }
  const localId = crypto.randomUUID()
  const localMessage = {
    id: localId,
    role: 'user' as const,
    timestamp: Date.now(),
    blocks: [{ type: 'text' as const, text: displayText }],
    attachments: attachments.map((file) => file.name),
    ...(submission?.task
      ? { capabilityLabel: { name: submission.task.name, icon: submission.task.icon } }
      : {}),
  }
  store.updateSession(session.id, {
    messages: [...session.messages, localMessage],
    updatedAt: Date.now(),
  })
  useWorkspace.setState({ runningSessionId: session.id, connectionError: null })
  try {
    const fileText = attachments
      .filter((file) => file.kind === 'text')
      .map((file) => `<file name=${JSON.stringify(file.name)}>\n${file.data}\n</file>`)
      .join('\n\n')
    const images = attachments
      .filter((file) => file.kind === 'image')
      .map((file) => ({ type: 'image', data: file.data, mimeType: file.mimeType }))
    const response = await request<{ disposition: string }>({
      type: 'prompt',
      message: [text, fileText].filter(Boolean).join('\n\n'),
      ...(images.length ? { images } : {}),
    })
    if (submission) {
      const state = await bridgeCall({ op: 'finish', requestId: submission.id })
      useWorkspace.setState({ capabilityBridge: state })
    }
    store.updateSession(session.id, {
      ...(unchanged() ? { draftNodes: [] } : {}),
      capabilities: { mode: submission?.mode || selected?.mode },
      pendingCapabilitySend: undefined,
    })
    if (!session.title) {
      const title = (
        displayText ||
        attachments[0]?.name ||
        submission?.task?.name ||
        t('sessions.new')
      ).slice(0, 36)
      store.updateSession(session.id, { title })
      await request({ type: 'set_session_name', name: title }).catch(() => {})
    }
    // Once pi accepts the prompt, a later refresh failure must not roll it back.
    if (response.disposition === 'handled') {
      try {
        const state = await request<RpcState>({ type: 'get_state' })
        if (!state.isStreaming) {
          useWorkspace.setState({ runningSessionId: null })
          await syncSession(session.id)
        }
      } catch (error) {
        useWorkspace.setState({ connectionError: errorText(error) })
      }
    }
    return true
  } catch (error) {
    if (submission) {
      // A timeout is not evidence of rejection. Check the durable receipt before
      // enabling a retry with the same id; never resubmit accepted work.
      try {
        const state = await bridgeCall({ op: 'status' })
        if (state.receipts.some((receipt) => receipt.id === submission!.id)) {
          store.updateSession(session.id, {
            ...(unchanged() ? { draftNodes: [] } : {}),
            capabilities: { mode: state.mode },
            pendingCapabilitySend: undefined,
          })
          useWorkspace.setState({
            capabilityBridge: state,
            connectionError: capabilityError(error),
          })
          const actual = await request<RpcState>({ type: 'get_state' })
          if (!actual.isStreaming) {
            useWorkspace.setState({ runningSessionId: null })
            await syncSession(session.id)
          }
          return true
        }
        if (/timeout|timed out|超时|process.*exit|进程.*退出/i.test(errorText(error))) {
          store.updateSession(session.id, {
            pendingCapabilitySend: { ...submission, uncertain: true },
          })
        } else await bridgeCall({ op: 'cancel', requestId: submission.id })
      } catch {
        // Keep the submission snapshot. The next attempt checks its receipt first.
        store.updateSession(session.id, {
          pendingCapabilitySend: { ...submission, uncertain: true },
        })
      }
    }
    const current = useWorkspace.getState().sessions.find((item) => item.id === session.id)
    store.updateSession(session.id, {
      messages: current?.messages.filter((message) => message.id !== localId) || session.messages,
    })
    useWorkspace.setState({ runningSessionId: null, connectionError: capabilityError(error) })
    return false
  }
}

export async function abortPrompt() {
  try {
    await request({ type: 'abort' })
  } catch (error) {
    useWorkspace.setState({ connectionError: errorText(error) })
  }
}
