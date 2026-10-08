import { Channel, invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type { Attachment, ExtensionPackage, ExtensionRequest, Model, RpcState, RuntimeEvent, SlashCommand, ThinkingLevel } from '../types'
import { isDesktop, useWorkspace } from '../store/workspace'
import { normalizeMessages, normalizeUsage } from './rpc'
import { errorText, list, modelKey, record, string } from './utils'

interface PiConnection { id: string; sessionId: string; path: string; executable: string; packages: ExtensionPackage[] }
let currentRun: PiConnection | null = null
const projectConnections = new Map<string, PiConnection>()
let connecting: Promise<void> | null = null
let extensionListener: ((request: ExtensionRequest) => void) | null = null
let noticeListener: ((message: string) => void) | null = null

export function onExtensionRequest(listener: (request: ExtensionRequest) => void) {
  extensionListener = listener
  return () => { extensionListener = null }
}
export function onRuntimeNotice(listener: (message: string) => void) {
  noticeListener = listener
  return () => { noticeListener = null }
}

export async function request<T>(command: Record<string, unknown>): Promise<T> {
  const run = currentRun
  if (!isDesktop || !run) throw new Error('请在桌面端连接 pi 后继续。')
  const value = await invoke<T>('pi_request', { runId: run.id, command: { id: crypto.randomUUID(), ...command } })
  if (currentRun !== run) throw new Error('会话已切换。')
  return value
}

export async function syncSession(sessionId: string) {
  const run = currentRun
  const [state, data, stats] = await Promise.all([
    request<RpcState>({ type: 'get_state' }),
    request<{ messages: unknown[] }>({ type: 'get_messages' }),
    request<unknown>({ type: 'get_session_stats' }),
  ])
  if (currentRun !== run || currentRun?.sessionId !== sessionId) return
  useWorkspace.getState().updateSession(sessionId, {
    piSessionFile: state.sessionFile, messages: normalizeMessages(data.messages), usage: normalizeUsage(stats),
    modelKey: state.model ? modelKey(state.model) : '', thinking: state.thinkingLevel,
    ...(state.sessionName ? { title: state.sessionName } : {}),
  })
}

function handleEvent({ runId, event }: RuntimeEvent) {
  if (event.type === 'runtime_exit') {
    for (const [path, run] of projectConnections) if (run.id === runId) projectConnections.delete(path)
  }
  if (currentRun?.id !== runId) return
  const sessionId = currentRun.sessionId
  const store = useWorkspace.getState()
  if (event.type === 'agent_start') useWorkspace.setState({ runningSessionId: sessionId, connectionError: null })
  if (event.type === 'runtime_exit') {
    currentRun = null
    useWorkspace.setState({ connection: 'error', connectionAction: null, runningSessionId: null, connectionError: 'pi 进程已退出，请重新连接。' })
    return
  }
  if (event.type === 'runtime_diagnostic') {
    // Diagnostics are retained only in the UI, never written to application logs.
    if (/error|failed|错误/i.test(string(event.message))) noticeListener?.(string(event.message))
    return
  }
  if (event.type === 'extension_ui_request') {
    const method = string(event.method)
    if (['select', 'confirm', 'input', 'editor'].includes(method)) extensionListener?.(event as unknown as ExtensionRequest)
    else if (method === 'notify') noticeListener?.(string(event.message))
    else if (method === 'set_editor_text' && store.connection !== 'connecting') store.updateSession(sessionId, { draft: string(event.text) })
    return
  }
  // pi replaces the session before its RPC acknowledgement; do not route replacement
  // events to the old desktop session while that transition is in progress.
  if (store.connection === 'connecting') return
  if (event.type === 'session_info_changed' && typeof event.name === 'string') store.updateSession(sessionId, { title: event.name })
  if (event.type === 'thinking_level_changed') store.updateSession(sessionId, { thinking: event.level as ThinkingLevel })
  store.appendEvent(sessionId, event)
  // agent_end can be followed by a retry/compaction; only settled releases the send lock.
  if (event.type === 'agent_settled') {
    const run = currentRun
    useWorkspace.setState({ runningSessionId: null })
    void syncSession(sessionId).catch(error => { if (currentRun === run && useWorkspace.getState().connection !== 'connecting') useWorkspace.setState({ connectionError: errorText(error) }) })
  }
}

export async function connectSession(sessionId: string, force = false): Promise<void> {
  if (!isDesktop) return
  // Serialize replacements so a late start/switch cannot replace a newer session.
  while (connecting) await connecting
  if (currentRun?.sessionId === sessionId && !force && useWorkspace.getState().connection === 'connected') return
  const store = useWorkspace.getState()
  if (store.runningSessionId) { useWorkspace.setState({ connectionError: '请等待当前任务完成后切换会话。' }); return }
  const session = store.sessions.find(item => item.id === sessionId)
  const project = store.projects.find(item => item.id === session?.projectId)
  if (!session || !project) return
  const previous = currentRun
  const cached = projectConnections.get(project.path)
  const reusable = !force && cached?.executable === store.piExecutable ? cached : undefined
  const reuse = Boolean(reusable)
  const runId = reusable?.id || crypto.randomUUID()
  useWorkspace.setState({ connection: 'connecting', connectionAction: reuse ? 'switch' : 'start', connectionError: null })
  const operation = (async () => {
    try {
      if (reusable) {
        currentRun = reusable
        if (reusable.sessionId !== sessionId) {
          const result = await request<{ cancelled?: boolean }>(session.piSessionFile
            ? { type: 'switch_session', sessionPath: session.piSessionFile }
            : { type: 'new_session' })
          if (result?.cancelled) {
            currentRun = previous
            useWorkspace.setState({ connection: previous ? 'connected' : 'disconnected', connectionAction: null, connectionError: 'pi 扩展取消了会话切换。', ...(store.activeSessionId === sessionId ? { activeSessionId: previous?.sessionId || null } : {}) })
            return
          }
        }
      } else {
        if (cached) {
          projectConnections.delete(project.path)
          if (currentRun?.id === cached.id) currentRun = null
          try { await invoke('stop_pi', { runId: cached.id }) }
          catch (error) {
            projectConnections.set(project.path, cached)
            currentRun = previous
            useWorkspace.setState({ connection: previous ? 'connected' : 'error', connectionAction: null, connectionError: errorText(error), ...(store.activeSessionId === sessionId && previous ? { activeSessionId: previous.sessionId } : {}) })
            return
          }
        }
        currentRun = { id: runId, sessionId, path: project.path, executable: store.piExecutable, packages: [] }
        projectConnections.set(project.path, currentRun)
        const channel = new Channel<RuntimeEvent>()
        channel.onmessage = handleEvent
        await invoke('start_pi', { path: project.path, executable: store.piExecutable, sessionFile: session.piSessionFile || null, runId, onEvent: channel })
      }
      if (currentRun?.id !== runId) return
      currentRun = { id: runId, sessionId, path: project.path, executable: store.piExecutable, packages: cached?.packages || [] }
      const [state, catalog, commands, packages] = await Promise.all([
        request<RpcState>({ type: 'get_state' }),
        request<{ models: Model[] }>({ type: 'get_available_models' }),
        request<{ commands: SlashCommand[] }>({ type: 'get_commands' }),
        reuse ? Promise.resolve(cached?.packages || []) : invoke<ExtensionPackage[]>('extension_packages', { path: project.path }).catch(() => []),
      ])
      if (currentRun?.id !== runId) return
      currentRun.packages = packages
      projectConnections.set(project.path, currentRun)
      useWorkspace.setState({ models: catalog.models, commands: commands.commands, packages })
      const selected = catalog.models.find(model => modelKey(model) === session.modelKey)
      if (selected && modelKey(selected) !== (state.model ? modelKey(state.model) : '')) {
        await request({ type: 'set_model', provider: selected.provider, modelId: selected.id })
      }
      const available = await request<{ levels: ThinkingLevel[] }>({ type: 'get_available_thinking_levels' })
      const thinking = available.levels.includes(session.thinking) ? session.thinking : available.levels[0] || 'off'
      await request({ type: 'set_thinking_level', level: thinking })
      useWorkspace.setState({ thinkingLevels: available.levels })
      if (session.pendingSessionName) {
        await request({ type: 'set_session_name', name: session.pendingSessionName })
        useWorkspace.getState().updateSession(sessionId, { pendingSessionName: undefined })
      }
      await syncSession(sessionId)
      if (currentRun?.id === runId) useWorkspace.setState({ connection: 'connected', connectionAction: null, runningSessionId: state.isStreaming ? sessionId : null })
    } catch (error) {
      if (currentRun?.id === runId || currentRun === null) {
        currentRun = null
        if (projectConnections.get(project.path)?.id === runId) projectConnections.delete(project.path)
        useWorkspace.setState({ connection: 'error', connectionAction: null, connectionError: errorText(error), runningSessionId: null })
        await invoke('stop_pi', { runId }).catch(() => {})
      }
    }
  })()
  connecting = operation
  try { await operation } finally { if (connecting === operation) connecting = null }
}

export async function initializeDesktop() {
  if (!isDesktop) return
  const store = useWorkspace.getState()
  if (!store.projects.length) {
    const { cwd } = await invoke<{ cwd: string }>('desktop_environment')
    const project = await invoke<{ path: string; branch: string | null }>('inspect_project', { path: cwd })
    const id = store.addProject(project.path, project.branch)
    store.createSession(id)
  }
}

export async function pickProject(): Promise<string | null> {
  if (!isDesktop) return null
  const selected = await open({ directory: true, multiple: false, title: '打开项目文件夹' })
  if (typeof selected !== 'string') return null
  const project = await invoke<{ path: string; branch: string | null }>('inspect_project', { path: selected })
  const store = useWorkspace.getState()
  const id = store.addProject(project.path, project.branch)
  store.createSession(id)
  return id
}

export async function changeModel(model: Model) {
  const store = useWorkspace.getState()
  if (!store.activeSessionId) return
  if (isDesktop) {
    await request({ type: 'set_model', provider: model.provider, modelId: model.id })
    const levels = await request<{ levels: ThinkingLevel[] }>({ type: 'get_available_thinking_levels' })
    useWorkspace.setState({ thinkingLevels: levels.levels })
    await syncSession(store.activeSessionId)
  } else store.updateSession(store.activeSessionId, { modelKey: modelKey(model), thinking: model.reasoning ? 'medium' : 'off' })
  store.rememberModel(modelKey(model))
}

export async function changeThinking(level: ThinkingLevel) {
  const store = useWorkspace.getState()
  if (!store.activeSessionId) return
  if (isDesktop) await request({ type: 'set_thinking_level', level })
  store.updateSession(store.activeSessionId, { thinking: level })
}

export async function sendPrompt(attachments: Attachment[]): Promise<boolean> {
  const store = useWorkspace.getState()
  const session = store.sessions.find(item => item.id === store.activeSessionId)
  if (!session || store.runningSessionId) return false
  if (!isDesktop) { useWorkspace.setState({ connectionError: '请启动桌面端并连接 pi 后发送消息。' }); return false }
  if (store.connection !== 'connected') { useWorkspace.setState({ connectionError: 'pi 尚未连接，请重新连接后发送。' }); return false }
  const text = session.draft.trim()
  if (!text && !attachments.length) return false
  const localId = crypto.randomUUID()
  const localMessage = { id: localId, role: 'user' as const, timestamp: Date.now(), blocks: [{ type: 'text' as const, text }], attachments: attachments.map(file => file.name) }
  store.updateSession(session.id, { messages: [...session.messages, localMessage], updatedAt: Date.now() })
  useWorkspace.setState({ runningSessionId: session.id, connectionError: null })
  try {
    const fileText = attachments.filter(file => file.kind === 'text').map(file => `<file name=${JSON.stringify(file.name)}>\n${file.data}\n</file>`).join('\n\n')
    const images = attachments.filter(file => file.kind === 'image').map(file => ({ type: 'image', data: file.data, mimeType: file.mimeType }))
    const response = await request<{ disposition: string }>({ type: 'prompt', message: [text, fileText].filter(Boolean).join('\n\n'), ...(images.length ? { images } : {}) })
    if (useWorkspace.getState().sessions.find(item => item.id === session.id)?.draft === session.draft) store.updateSession(session.id, { draft: '' })
    if (session.title === '新聊天') {
      const title = (text || attachments[0]?.name || '新聊天').slice(0, 36)
      store.updateSession(session.id, { title })
      await request({ type: 'set_session_name', name: title }).catch(() => {})
    }
    // Once pi accepts the prompt, a later refresh failure must not roll it back.
    if (response.disposition === 'handled') {
      try {
        const state = await request<RpcState>({ type: 'get_state' })
        if (!state.isStreaming) { useWorkspace.setState({ runningSessionId: null }); await syncSession(session.id) }
      } catch (error) { useWorkspace.setState({ connectionError: errorText(error) }) }
    }
    return true
  } catch (error) {
    const current = useWorkspace.getState().sessions.find(item => item.id === session.id)
    store.updateSession(session.id, { messages: current?.messages.filter(message => message.id !== localId) || session.messages })
    useWorkspace.setState({ runningSessionId: null, connectionError: errorText(error) })
    return false
  }
}

export async function abortPrompt() {
  try { await request({ type: 'abort' }) } catch (error) { useWorkspace.setState({ connectionError: errorText(error) }) }
}

export async function extensionResponse(id: string, response: Record<string, unknown>) {
  await request({ type: 'extension_ui_response', id, ...response })
}

export async function readAttachments(files: FileList | File[]): Promise<Attachment[]> {
  const results: Attachment[] = []
  for (const file of Array.from(files)) {
    const image = /^image\/(png|jpeg|webp|gif)$/.test(file.type)
    const text = file.type.startsWith('text/') || /\.(md|json|csv|log|tsx?|jsx?|rs|py|go|toml|ya?ml|css|html|sh|txt)$/i.test(file.name)
    if (!image && !text) throw new Error(`暂不支持 ${file.name}，请选择图片或文本文件。`)
    if (file.size > (image ? 8 * 1024 * 1024 : 512 * 1024)) throw new Error(`${file.name} 过大，图片需小于 8MB，文本需小于 512KB。`)
    let data: string
    if (image) data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(string(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error(`无法读取 ${file.name}`)); reader.readAsDataURL(file) })
    else data = await file.text()
    results.push({ id: crypto.randomUUID(), name: file.name, data, kind: image ? 'image' : 'text', mimeType: file.type || 'text/plain' })
  }
  return results
}

export async function renameSession(sessionId: string, value: string) {
  const store = useWorkspace.getState()
  const name = value.trim()
  if (!name || name.length > 100 || !store.sessions.some(session => session.id === sessionId)) throw new Error('请输入有效的会话名称。')
  if (store.runningSessionId || store.connection === 'connecting') throw new Error('请等待当前任务完成后重命名。')
  const connected = isDesktop && currentRun?.sessionId === sessionId && store.connection === 'connected'
  if (connected) await request({ type: 'set_session_name', name })
  useWorkspace.getState().updateSession(sessionId, { title: name, pendingSessionName: isDesktop && !connected ? name : undefined })
}

export async function removeSession(sessionId: string) {
  const store = useWorkspace.getState()
  if (!store.sessions.some(session => session.id === sessionId)) return
  if (store.runningSessionId === sessionId || (store.activeSessionId === sessionId && (store.runningSessionId || store.connection === 'connecting'))) throw new Error('请等待当前任务完成后移除会话。')
  const run = [...projectConnections.values()].find(run => run.sessionId === sessionId)
  if (isDesktop && run) {
    const active = currentRun?.id === run.id
    projectConnections.delete(run.path)
    if (active) { currentRun = null; useWorkspace.setState({ connection: 'connecting', connectionAction: 'switch' }) }
    try {
      await invoke('stop_pi', { runId: run.id })
      if (active) useWorkspace.setState({ connection: 'disconnected', connectionAction: null })
    } catch (error) {
      projectConnections.set(run.path, run)
      if (active) { currentRun = run; useWorkspace.setState({ connection: store.connection, connectionAction: null }) }
      throw error
    }
  }
  if (!useWorkspace.getState().removeSession(sessionId)) throw new Error('当前会话暂时无法移除。')
}

export function exportSession(sessionId?: string) {
  const store = useWorkspace.getState()
  const session = store.sessions.find(item => item.id === (sessionId || store.activeSessionId))
  if (!session) return
  const text = `# ${session.title}\n\n` + session.messages.map(message => `## ${message.role === 'user' ? '用户' : '回复'}\n\n${message.blocks.map(block => block.type === 'tool' ? `### ${block.name} · ${block.label}\n\n\`\`\`\n${block.output}\n\`\`\`` : block.text).join('\n\n')}`).join('\n\n') + (session.draft ? `\n\n## 草稿\n\n${session.draft}` : '') + (session.attachments?.length ? `\n\n## 草稿附件\n\n${session.attachments.map(file => file.kind === 'image' ? `![${file.name}](data:${file.mimeType};base64,${file.data})` : `### ${file.name}\n\n\`\`\`\n${file.data}\n\`\`\``).join('\n\n')}` : '')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `${session.title.replace(/[<>:"/\\|?*]/g, '-')}.md`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function decodeExtensionRequest(value: unknown): ExtensionRequest | null {
  const req = record(value)
  if (!['select', 'confirm', 'input', 'editor'].includes(string(req.method))) return null
  return { id: string(req.id), method: req.method as ExtensionRequest['method'], title: string(req.title), message: string(req.message), options: list(req.options).map(value => string(value)), timeout: typeof req.timeout === 'number' ? req.timeout : undefined }
}
