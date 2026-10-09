import type { Model, ThinkingLevel } from '../../types'
import { isDesktop, useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { modelKey } from '../utils'
import { request, syncSession } from './requests'
import { runtimeState } from './runtimeState'

export async function changeModel(model: Model) {
  const store = useWorkspace.getState()
  if (!store.activeSessionId) return
  if (isDesktop) {
    await request({ type: 'set_model', provider: model.provider, modelId: model.id })
    const levels = await request<{ levels: ThinkingLevel[] }>({
      type: 'get_available_thinking_levels',
    })
    useWorkspace.setState({ thinkingLevels: levels.levels })
    await syncSession(store.activeSessionId)
  } else
    store.updateSession(store.activeSessionId, {
      modelKey: modelKey(model),
      thinking: model.reasoning ? 'medium' : 'off',
    })
  store.rememberModel(modelKey(model))
}

export async function changeThinking(level: ThinkingLevel) {
  const store = useWorkspace.getState()
  if (!store.activeSessionId) return
  if (isDesktop) await request({ type: 'set_thinking_level', level })
  store.updateSession(store.activeSessionId, { thinking: level })
}

export async function renameSession(sessionId: string, value: string) {
  const store = useWorkspace.getState()
  const name = value.trim()
  if (!name || name.length > 100 || !store.sessions.some((session) => session.id === sessionId))
    throw new Error(t('errors.invalidSessionName'))
  if (store.runningSessionId || store.connection === 'connecting')
    throw new Error(t('errors.renameWhileRunning'))
  const connected =
    isDesktop &&
    runtimeState.currentRun?.sessionId === sessionId &&
    store.connection === 'connected'
  if (connected) await request({ type: 'set_session_name', name })
  useWorkspace.getState().updateSession(sessionId, {
    title: name,
    pendingSessionName: isDesktop && !connected ? name : undefined,
  })
}

export async function removeSession(sessionId: string) {
  const store = useWorkspace.getState()
  if (!store.sessions.some((session) => session.id === sessionId)) return
  if (
    store.runningSessionId === sessionId ||
    store.connection === 'connecting' ||
    (store.activeSessionId === sessionId && store.runningSessionId)
  )
    throw new Error(t('errors.removeWhileRunning'))
  const run = [...runtimeState.projectConnections.values()].find(
    (run) => run.sessionId === sessionId,
  )
  if (isDesktop && run) {
    run.bindingVersion++
    run.sessionId = null
    run.bindingUncertain = false
    if (runtimeState.currentRun === run) runtimeState.currentRun = null
  }
  if (!useWorkspace.getState().removeSession(sessionId)) throw new Error(t('errors.removeSession'))
}

export function exportSession(sessionId?: string) {
  const store = useWorkspace.getState()
  const session = store.sessions.find((item) => item.id === (sessionId || store.activeSessionId))
  if (!session) return
  const title = session.title || t('sessions.new')
  const text =
    `# ${title}\n\n` +
    session.messages
      .map(
        (message) =>
          `## ${t(message.role === 'user' ? 'export.user' : 'export.assistant')}\n\n${message.blocks.map((block) => (block.type === 'tool' ? `### ${block.name} · ${block.label}\n\n\`\`\`\n${block.output}\n\`\`\`` : block.text)).join('\n\n')}`,
      )
      .join('\n\n') +
    (session.draft ? `\n\n## ${t('export.draft')}\n\n${session.draft}` : '') +
    (session.attachments?.length
      ? `\n\n## ${t('export.attachments')}\n\n${session.attachments.map((file) => (file.kind === 'image' ? `![${file.name}](data:${file.mimeType};base64,${file.data})` : `### ${file.name}\n\n\`\`\`\n${file.data}\n\`\`\``)).join('\n\n')}`
      : '')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.replace(/[<>:"/\\|?*]/g, '-')}.md`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
