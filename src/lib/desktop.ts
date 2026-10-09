import { Channel, invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type {
  Attachment,
  ExtensionPackage,
  ExtensionRequest,
  Model,
  Project,
  RpcState,
  RuntimeEvent,
  SlashCommand,
  ThinkingLevel,
} from '../types'
import { isDesktop, useWorkspace } from '../store/workspace'
import { normalizeMessages, normalizeUsage } from './rpc'
import { t } from './i18n'
import { errorText, list, modelKey, record, string } from './utils'

interface PiConnection {
  id: string
  sessionId: string | null
  path: string
  executable: string
  packages: ExtensionPackage[]
  ponytailLoaded?: boolean
  bindingUncertain?: boolean
  needsReconcile?: boolean
}
let currentRun: PiConnection | null = null
const projectConnections = new Map<string, PiConnection>()
let connecting: Promise<void> | null = null
let initializing: Promise<void> | null = null
let extensionListener: ((request: ExtensionRequest) => void) | null = null
let noticeListener: ((message: string) => void) | null = null

export function onExtensionRequest(listener: (request: ExtensionRequest) => void) {
  extensionListener = listener
  return () => {
    extensionListener = null
  }
}
export function onRuntimeNotice(listener: (message: string) => void) {
  noticeListener = listener
  return () => {
    noticeListener = null
  }
}

export async function request<T>(command: Record<string, unknown>): Promise<T> {
  const run = currentRun
  if (!isDesktop || !run) throw new Error(t('errors.desktopRequired'))
  const sessionId = run.sessionId
  const value = await invoke<T>('pi_request', {
    runId: run.id,
    command: { id: crypto.randomUUID(), ...command },
  })
  if (currentRun !== run || run.sessionId !== sessionId) throw new Error(t('errors.sessionChanged'))
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
    piSessionFile: state.sessionFile,
    messages: normalizeMessages(data.messages),
    usage: normalizeUsage(stats),
    modelKey: state.model ? modelKey(state.model) : '',
    thinking: state.thinkingLevel,
    ...(state.sessionName ? { title: state.sessionName } : {}),
  })
}

function handleEvent({ runId, event }: RuntimeEvent) {
  if (event.type === 'runtime_exit') {
    for (const [path, run] of projectConnections)
      if (run.id === runId) projectConnections.delete(path)
  }
  if (currentRun?.id !== runId) return
  const sessionId = currentRun.sessionId
  const store = useWorkspace.getState()
  if (event.type === 'runtime_exit') {
    currentRun = null
    useWorkspace.setState({
      connection: 'error',
      connectionAction: null,
      runningSessionId: null,
      connectionError: t('errors.processExited'),
    })
    return
  }
  if (event.type === 'runtime_diagnostic') {
    // Diagnostics are retained only in the UI, never written to application logs.
    if (/error|failed|错误/i.test(string(event.message))) noticeListener?.(string(event.message))
    return
  }
  if (event.type === 'extension_ui_request') {
    const method = string(event.method)
    if (['select', 'confirm', 'input', 'editor'].includes(method))
      extensionListener?.(event as unknown as ExtensionRequest)
    else if (method === 'notify') {
      const message = string(event.message)
      // Ponytail announces every session_start, including both RPC rebinds on
      // session replacement. Its loading toast belongs to the process lifetime.
      if (/^Ponytail loaded: (lite|full|ultra|off)$/.test(message)) {
        const alreadyLoaded = currentRun.ponytailLoaded
        currentRun.ponytailLoaded = true
        if (alreadyLoaded || store.connectionAction === 'switch') return
      }
      noticeListener?.(message)
    } else if (
      method === 'set_editor_text' &&
      sessionId &&
      !currentRun.bindingUncertain &&
      !currentRun.needsReconcile &&
      store.connection === 'connected'
    )
      store.updateSession(sessionId, { draft: string(event.text) })
    return
  }
  // pi replaces the session before its RPC acknowledgement; do not route replacement
  // events to the old desktop session while that transition is in progress.
  if (
    !sessionId ||
    currentRun.bindingUncertain ||
    currentRun.needsReconcile ||
    store.connection !== 'connected'
  )
    return
  if (event.type === 'agent_start')
    useWorkspace.setState({ runningSessionId: sessionId, connectionError: null })
  if (event.type === 'session_info_changed' && typeof event.name === 'string')
    store.updateSession(sessionId, { title: event.name })
  if (event.type === 'thinking_level_changed')
    store.updateSession(sessionId, { thinking: event.level as ThinkingLevel })
  store.appendEvent(sessionId, event)
  // agent_end can be followed by a retry/compaction; only settled releases the send lock.
  if (event.type === 'agent_settled') {
    const run = currentRun
    useWorkspace.setState({ runningSessionId: null })
    void syncSession(sessionId).catch((error) => {
      if (currentRun === run && useWorkspace.getState().connection !== 'connecting')
        useWorkspace.setState({ connectionError: errorText(error) })
    })
  }
}

export async function connectSession(sessionId: string, force = false): Promise<void> {
  // A retained React state during Fast Refresh must not race startup recovery.
  if (initializing) {
    try {
      await initializing
    } catch {
      return
    }
  }
  await activateSession(sessionId, force)
}

async function startProjectConnection(
  project: Project,
  executable: string,
  runId: string,
  sessionId: string | null = null,
  sessionFile: string | null = null,
): Promise<PiConnection> {
  const run: PiConnection = {
    id: runId,
    sessionId,
    path: project.path,
    executable,
    packages: [],
  }
  currentRun = run
  projectConnections.set(project.path, run)
  const channel = new Channel<RuntimeEvent>()
  channel.onmessage = handleEvent
  await invoke('start_pi', {
    path: project.path,
    executable,
    sessionFile,
    runId,
    onEvent: channel,
  })
  return run
}

async function warmProject(project: Project) {
  const executable = useWorkspace.getState().piExecutable
  const cached = projectConnections.get(project.path)
  if (cached?.executable === executable) return
  if (cached) {
    await invoke('stop_pi', { runId: cached.id })
    projectConnections.delete(project.path)
    if (currentRun === cached) currentRun = null
  }
  const previous = currentRun
  const previousConnection = useWorkspace.getState().connection
  const runId = crypto.randomUUID()
  useWorkspace.setState({ connection: 'connecting', connectionAction: 'start' })
  try {
    const run = await startProjectConnection(project, executable, runId)
    await request<RpcState>({ type: 'get_state' })
    run.packages = await invoke<ExtensionPackage[]>('extension_packages', {
      path: project.path,
    }).catch(() => [])
    if (projectConnections.get(project.path) !== run) throw new Error(t('errors.processExited'))
  } catch (error) {
    if (projectConnections.get(project.path)?.id === runId) projectConnections.delete(project.path)
    await invoke('stop_pi', { runId }).catch(() => {})
    throw error
  } finally {
    currentRun = previous && projectConnections.get(previous.path) === previous ? previous : null
    useWorkspace.setState({
      connection: currentRun?.sessionId ? previousConnection : 'disconnected',
      connectionAction: null,
    })
  }
}

async function activateSession(sessionId: string, force = false): Promise<void> {
  if (!isDesktop) return
  // Serialize replacements so a late start/switch cannot replace a newer session.
  while (connecting) await connecting
  if (
    currentRun?.sessionId === sessionId &&
    currentRun.executable === useWorkspace.getState().piExecutable &&
    !currentRun.needsReconcile &&
    !force &&
    useWorkspace.getState().connection === 'connected'
  )
    return
  const store = useWorkspace.getState()
  if (store.runningSessionId) {
    useWorkspace.setState({ connectionError: t('errors.switchWhileRunning') })
    return
  }
  const session = store.sessions.find((item) => item.id === sessionId)
  const project = store.projects.find((item) => item.id === session?.projectId)
  if (!session || !project) return
  const previous = currentRun
  const cached = projectConnections.get(project.path)
  const reusable = !force && cached?.executable === store.piExecutable ? cached : undefined
  const reuse = Boolean(reusable)
  const runId = reusable?.id || crypto.randomUUID()
  useWorkspace.setState({
    connection: 'connecting',
    connectionAction: reuse ? 'switch' : 'start',
    connectionError: null,
  })
  const operation = (async () => {
    let replacing = false
    try {
      if (reusable) {
        currentRun = reusable
        if (reusable.needsReconcile || reusable.bindingUncertain || store.connection === 'error') {
          const actual = await request<RpcState>({ type: 'get_state' })
          if (reusable.bindingUncertain) {
            reusable.sessionId =
              store.sessions.find(
                (item) =>
                  item.projectId === project.id &&
                  actual.sessionFile &&
                  item.piSessionFile === actual.sessionFile,
              )?.id || null
            reusable.bindingUncertain = false
          }
          if (actual.isStreaming && reusable.sessionId !== sessionId)
            throw new Error(t('errors.switchWhileRunning'))
        }
        if (reusable.sessionId !== sessionId) {
          replacing = true
          const result = await request<{ cancelled?: boolean }>(
            session.piSessionFile
              ? { type: 'switch_session', sessionPath: session.piSessionFile }
              : { type: 'new_session' },
          )
          replacing = false
          if (result?.cancelled) {
            currentRun = previous
            useWorkspace.setState({
              connection:
                previous?.sessionId && store.connection === 'connected'
                  ? 'connected'
                  : 'disconnected',
              connectionAction: null,
              connectionError: t('errors.switchCancelled'),
              ...(store.activeSessionId === sessionId
                ? { activeSessionId: previous?.sessionId || null }
                : {}),
            })
            return
          }
          reusable.sessionId = sessionId
        }
      } else {
        if (cached) {
          projectConnections.delete(project.path)
          if (currentRun?.id === cached.id) currentRun = null
          try {
            await invoke('stop_pi', { runId: cached.id })
          } catch (error) {
            projectConnections.set(project.path, cached)
            currentRun = previous
            useWorkspace.setState({
              connection: previous ? 'connected' : 'error',
              connectionAction: null,
              connectionError: errorText(error),
              ...(store.activeSessionId === sessionId && previous
                ? { activeSessionId: previous.sessionId }
                : {}),
            })
            return
          }
        }
        await startProjectConnection(
          project,
          store.piExecutable,
          runId,
          sessionId,
          session.piSessionFile || null,
        )
      }
      if (currentRun?.id !== runId) return
      const [state, catalog, commands, packages] = await Promise.all([
        request<RpcState>({ type: 'get_state' }),
        request<{ models: Model[] }>({ type: 'get_available_models' }),
        request<{ commands: SlashCommand[] }>({ type: 'get_commands' }),
        reuse
          ? Promise.resolve(cached?.packages || [])
          : invoke<ExtensionPackage[]>('extension_packages', { path: project.path }).catch(
              () => [],
            ),
      ])
      if (currentRun?.id !== runId) return
      currentRun.packages = packages
      projectConnections.set(project.path, currentRun)
      useWorkspace.setState({ models: catalog.models, commands: commands.commands, packages })
      const selected = catalog.models.find((model) => modelKey(model) === session.modelKey)
      if (
        !state.isStreaming &&
        selected &&
        modelKey(selected) !== (state.model ? modelKey(state.model) : '')
      ) {
        await request({ type: 'set_model', provider: selected.provider, modelId: selected.id })
      }
      const available = await request<{ levels: ThinkingLevel[] }>({
        type: 'get_available_thinking_levels',
      })
      const thinking = available.levels.includes(session.thinking)
        ? session.thinking
        : available.levels[0] || 'off'
      if (!state.isStreaming) await request({ type: 'set_thinking_level', level: thinking })
      useWorkspace.setState({ thinkingLevels: available.levels })
      if (!state.isStreaming && session.pendingSessionName) {
        await request({ type: 'set_session_name', name: session.pendingSessionName })
        useWorkspace.getState().updateSession(sessionId, { pendingSessionName: undefined })
      }
      await syncSession(sessionId)
      if (currentRun?.id === runId) {
        currentRun.needsReconcile = false
        useWorkspace.setState({
          connection: 'connected',
          connectionAction: null,
          runningSessionId: state.isStreaming ? sessionId : null,
        })
      }
    } catch (error) {
      if (currentRun?.id === runId || currentRun === null) {
        if (reusable && projectConnections.get(project.path) === reusable) {
          reusable.needsReconcile = true
          if (replacing) {
            reusable.sessionId = null
            reusable.bindingUncertain = true
          }
        } else {
          currentRun = null
          if (projectConnections.get(project.path)?.id === runId)
            projectConnections.delete(project.path)
        }
        useWorkspace.setState({
          connection: 'error',
          connectionAction: null,
          connectionError: errorText(error),
          runningSessionId: null,
        })
        if (!reuse) await invoke('stop_pi', { runId }).catch(() => {})
      }
    }
  })()
  connecting = operation
  try {
    await operation
  } finally {
    if (connecting === operation) connecting = null
  }
}

export async function syncDesktopLanguage() {
  if (isDesktop) await invoke('set_app_language', { language: useWorkspace.getState().language })
}

export async function initializeLanguage() {
  if (!isDesktop) return
  const locale = await invoke<string>('system_locale')
  useWorkspace.getState().applySystemLocale(locale)
  await syncDesktopLanguage()
}

export function initializeDesktop(): Promise<void> {
  if (initializing) return initializing
  const operation = prepareDesktop()
  initializing = operation
  void operation
    .finally(() => {
      if (initializing === operation) initializing = null
    })
    .catch(() => {})
  return operation
}

async function prepareDesktop() {
  if (!isDesktop) return
  await initializeLanguage()
  let store = useWorkspace.getState()
  if (!store.projects.length) {
    const { cwd } = await invoke<{ cwd: string }>('desktop_environment')
    const project = await invoke<{ path: string; branch: string | null }>('inspect_project', {
      path: cwd,
    })
    const id = store.addProject(project.path, project.branch)
    store.createSession(id)
  }
  store = useWorkspace.getState()
  const preferred = store.activeSessionId
  let resumedSession: string | null = null
  const live =
    await invoke<Omit<PiConnection, 'sessionId' | 'packages' | 'ponytailLoaded'>[]>(
      'pi_connections',
    )
  // A refreshed frontend reattaches its event channel to the native-owned process.
  for (const run of live) {
    const project = store.projects.find((project) => project.path === run.path)
    if (!project) continue
    const channel = new Channel<RuntimeEvent>()
    channel.onmessage = handleEvent
    try {
      await invoke('attach_pi', { runId: run.id, onEvent: channel })
      const state = await invoke<RpcState>('pi_request', {
        runId: run.id,
        command: { id: crypto.randomUUID(), type: 'get_state' },
      })
      const candidates = store.sessions.filter((session) => session.projectId === project.id)
      const matched = candidates.find(
        (session) => state.sessionFile && session.piSessionFile === state.sessionFile,
      )
      // An idle unmatched native session may belong to a deleted desktop session.
      // Keep its process, but never copy its history into a surviving session.
      const session =
        matched ||
        (state.isStreaming
          ? candidates.find((session) => session.id === preferred) || candidates[0]
          : undefined)
      if (!session && state.isStreaming) throw new Error(t('errors.switchWhileRunning'))
      // Preserve a still-running or not-yet-saved session instead of replacing it.
      if (
        session &&
        state.sessionFile &&
        !candidates.some((session) => session.piSessionFile === state.sessionFile)
      ) {
        store.updateSession(session.id, { piSessionFile: state.sessionFile })
      }
      const packages = await invoke<ExtensionPackage[]>('extension_packages', {
        path: run.path,
      }).catch(() => [])
      projectConnections.set(run.path, {
        ...run,
        sessionId: session?.id || null,
        packages,
        ponytailLoaded: true,
      })
      if (state.isStreaming && session) resumedSession = session.id
    } catch (error) {
      // Do not kill a potentially running task when attaching or reading state fails.
      // A retry discovers the pool again, including processes that exited meanwhile.
      throw new Error(`${project.name}: ${errorText(error)}`, { cause: error })
    }
  }
  store = useWorkspace.getState()
  const target =
    resumedSession ||
    preferred ||
    store.sessions.find(
      (session) => !store.projects.find((project) => project.id === session.projectId)?.hidden,
    )?.id
  if (target && target !== store.activeSessionId) useWorkspace.setState({ activeSessionId: target })
  const failures: string[] = []
  // Warm every saved project before showing the workspace; restore the active one last.
  for (const project of store.projects) {
    if (project.hidden) continue
    const session =
      store.sessions.find((session) => session.projectId === project.id && session.id === target) ||
      [...store.sessions]
        .filter((session) => session.projectId === project.id)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (!session) {
      try {
        await warmProject(project)
      } catch (error) {
        failures.push(`${project.name}: ${errorText(error)}`)
      }
      continue
    }
    if (session.id === target) continue
    await activateSession(session.id)
    if (useWorkspace.getState().connection === 'error')
      failures.push(`${project.name}: ${useWorkspace.getState().connectionError}`)
  }
  if (target) {
    await activateSession(target)
    if (useWorkspace.getState().connection === 'error')
      failures.push(useWorkspace.getState().connectionError || t('connection.failed'))
  }
  if (failures.length) throw new Error(failures.join('\n'))
}

export async function pickProject(): Promise<string | null> {
  if (!isDesktop) return null
  const selected = await open({ directory: true, multiple: false, title: t('projects.openFolder') })
  if (typeof selected !== 'string') return null
  const project = await invoke<{ path: string; branch: string | null }>('inspect_project', {
    path: selected,
  })
  const store = useWorkspace.getState()
  const id = store.addProject(project.path, project.branch)
  store.createSession(id)
  return id
}

export async function revealProject(path: string) {
  if (!isDesktop) throw new Error(t('errors.revealRequiresDesktop'))
  await invoke('reveal_project', { path })
}

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

export async function sendPrompt(attachments: Attachment[]): Promise<boolean> {
  const store = useWorkspace.getState()
  const session = store.sessions.find((item) => item.id === store.activeSessionId)
  if (!session || store.runningSessionId) return false
  if (!isDesktop) {
    useWorkspace.setState({ connectionError: t('errors.sendRequiresDesktop') })
    return false
  }
  if (store.connection !== 'connected' || currentRun?.sessionId !== session.id) {
    useWorkspace.setState({ connectionError: t('errors.notConnected') })
    return false
  }
  const text = session.draft.trim()
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
    if (
      useWorkspace.getState().sessions.find((item) => item.id === session.id)?.draft ===
      session.draft
    )
      store.updateSession(session.id, { draft: '' })
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

export async function extensionResponse(id: string, response: Record<string, unknown>) {
  await request({ type: 'extension_ui_response', id, ...response })
}

export async function readAttachments(files: FileList | File[]): Promise<Attachment[]> {
  const results: Attachment[] = []
  for (const file of Array.from(files)) {
    const image = /^image\/(png|jpeg|webp|gif)$/.test(file.type)
    const text =
      file.type.startsWith('text/') ||
      /\.(md|json|csv|log|tsx?|jsx?|rs|py|go|toml|ya?ml|css|html|sh|txt)$/i.test(file.name)
    if (!image && !text) throw new Error(t('errors.unsupportedAttachment', { file: file.name }))
    if (file.size > (image ? 8 * 1024 * 1024 : 512 * 1024))
      throw new Error(t('errors.attachmentTooLarge', { file: file.name }))
    let data: string
    if (image)
      data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(string(reader.result).split(',')[1] || '')
        reader.onerror = () => reject(new Error(t('errors.readAttachment', { file: file.name })))
        reader.readAsDataURL(file)
      })
    else data = await file.text()
    results.push({
      id: crypto.randomUUID(),
      name: file.name,
      data,
      kind: image ? 'image' : 'text',
      mimeType: file.type || 'text/plain',
    })
  }
  return results
}

export async function renameSession(sessionId: string, value: string) {
  const store = useWorkspace.getState()
  const name = value.trim()
  if (!name || name.length > 100 || !store.sessions.some((session) => session.id === sessionId))
    throw new Error(t('errors.invalidSessionName'))
  if (store.runningSessionId || store.connection === 'connecting')
    throw new Error(t('errors.renameWhileRunning'))
  const connected =
    isDesktop && currentRun?.sessionId === sessionId && store.connection === 'connected'
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
  const run = [...projectConnections.values()].find((run) => run.sessionId === sessionId)
  if (isDesktop && run) {
    run.sessionId = null
    run.bindingUncertain = false
    if (currentRun === run) currentRun = null
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

export function decodeExtensionRequest(value: unknown): ExtensionRequest | null {
  const req = record(value)
  if (!['select', 'confirm', 'input', 'editor'].includes(string(req.method))) return null
  return {
    id: string(req.id),
    method: req.method as ExtensionRequest['method'],
    title: string(req.title),
    message: string(req.message),
    options: list(req.options).map((value) => string(value)),
    timeout: typeof req.timeout === 'number' ? req.timeout : undefined,
  }
}

// Keep metadata and cached project connections consistent after package changes.
export async function refreshExtensionPackages(path: string) {
  if (!isDesktop) throw new Error(t('packages.desktopOnly'))
  const packages = await invoke<ExtensionPackage[]>('extension_packages', { path })
  const cached = projectConnections.get(path)
  if (cached) cached.packages = packages
  if (currentRun?.path === path) currentRun.packages = packages
  const store = useWorkspace.getState()
  const active = store.sessions.find((session) => session.id === store.activeSessionId)
  if (store.projects.find((project) => project.id === active?.projectId)?.path === path) {
    useWorkspace.setState({ packages })
  }
  return packages
}
