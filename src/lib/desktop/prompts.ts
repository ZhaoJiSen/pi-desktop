import type { Attachment, RpcState, SlashCommand } from '../../types'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { errorText } from '../utils'
import { planDraft, sessionDraft } from '../draft'
import { loadBuiltinCommands } from '../commands'
import { draftProblemMessage } from '../draftMessages'
import { request, syncSession } from './requests'
import { runtimeState } from './runtimeState'

export async function sendPrompt(attachments: Attachment[]): Promise<boolean> {
  const store = useWorkspace.getState()
  const session = store.sessions.find((item) => item.id === store.activeSessionId)
  if (!session || store.runningSessionId) return false
  if (!isDesktop) {
    useWorkspace.setState({ connectionError: t('errors.sendRequiresDesktop') })
    return false
  }
  if (store.connection !== 'connected' || runtimeState.currentRun?.sessionId !== session.id) {
    useWorkspace.setState({ connectionError: t('errors.notConnected') })
    return false
  }
  let text = session.draft.trim()
  const unchanged = () => {
    const current = useWorkspace.getState().sessions.find((item) => item.id === session.id)
    return (
      current?.draft === session.draft &&
      JSON.stringify(current?.draftNodes) === JSON.stringify(session.draftNodes)
    )
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
  if (!text && !attachments.length) return false
  const localId = crypto.randomUUID()
  const localMessage = {
    id: localId,
    role: 'user' as const,
    timestamp: Date.now(),
    blocks: [{ type: 'text' as const, text }],
    attachments: attachments.map((file) => file.name),
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
    if (unchanged()) store.updateSession(session.id, { draftNodes: [] })
    if (!session.title) {
      const title = (text || attachments[0]?.name || t('sessions.new')).slice(0, 36)
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
    const current = useWorkspace.getState().sessions.find((item) => item.id === session.id)
    store.updateSession(session.id, {
      messages: current?.messages.filter((message) => message.id !== localId) || session.messages,
    })
    useWorkspace.setState({ runningSessionId: null, connectionError: errorText(error) })
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
