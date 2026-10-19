import type { ExtensionRequest, RuntimeEvent, ThinkingLevel } from '../../types'
import { useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { errorText, list, record, string } from '../utils'
import { request, syncSession } from './requests'
import { runtimeState, type PiConnection } from './runtimeState'
import { diagnosticNotice, isStaleExtensionContext } from './diagnostics'

let extensionListener: ((request: ExtensionRequest) => void) | null = null
let noticeListener: ((message: string) => void) | null = null

function recoverContextFailure(run: PiConnection, message: string) {
  if (!run.hasReplacedSession || !isStaleExtensionContext(message)) return false
  runtimeState.sessionRestartPaths.set(run.path, run.executable)
  const store = useWorkspace.getState()
  // A running prompt must never be restarted or replayed by recovery.
  if (store.runningSessionId || store.piBusyRuns.includes(run.id)) return false
  if (!run.contextFailed) {
    run.contextFailed = true
    void import('./connections')
      .then(({ recoverStaleContext }) => recoverStaleContext(run))
      .catch((error) => {
        if (useWorkspace.getState().activeSessionId === run.sessionId)
          useWorkspace.setState({ connectionError: errorText(error) })
      })
  }
  return true
}

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

export function handleEvent({ runId, event }: RuntimeEvent) {
  if (event.type === 'agent_start')
    useWorkspace.setState((state) => ({ piBusyRuns: [...new Set([...state.piBusyRuns, runId])] }))
  if (event.type === 'agent_settled' || event.type === 'runtime_exit')
    useWorkspace.setState((state) => ({
      piBusyRuns: state.piBusyRuns.filter((id) => id !== runId),
    }))
  if (event.type === 'runtime_exit') {
    for (const [path, run] of runtimeState.projectConnections)
      if (run.id === runId) runtimeState.projectConnections.delete(path)
  }
  if (runtimeState.currentRun?.id !== runId) {
    // stdout EOF and stderr are read independently. The failure line can arrive
    // just after runtime_exit. Retain only the last exited foreground binding;
    // a newly started process must never be replaced by a late old diagnostic.
    const exited = runtimeState.lastExitedRun
    if (!runtimeState.currentRun && exited?.id === runId && event.type === 'runtime_diagnostic')
      recoverContextFailure(exited, string(event.message))
    return
  }
  const run = runtimeState.currentRun
  const sessionId = run.sessionId
  const store = useWorkspace.getState()
  if (event.type === 'runtime_exit') {
    runtimeState.lastExitedRun = run
    runtimeState.currentRun = null
    useWorkspace.setState({
      connection: run.contextFailed ? 'disconnected' : 'error',
      connectionAction: null,
      runningSessionId: null,
      connectionError: run.contextFailed ? null : t('errors.processExited'),
    })
    return
  }
  if (event.type === 'runtime_diagnostic' || event.type === 'extension_error') {
    // Diagnostics are retained only in the UI, never written to application logs.
    const message = string(event.type === 'extension_error' ? event.error : event.message)
    if (recoverContextFailure(run, message)) return
    if (run.contextFailed) return
    const notice = diagnosticNotice(message)
    if (notice) noticeListener?.(notice)
    return
  }
  if (event.type === 'extension_ui_request') {
    const method = string(event.method)
    if (['select', 'confirm', 'input', 'editor'].includes(method))
      extensionListener?.({
        ...(event as unknown as ExtensionRequest),
        runId,
        sessionId,
        afterMessageId: store.sessions.find((session) => session.id === sessionId)?.messages.at(-1)
          ?.id,
      })
    else if (method === 'notify') {
      const message = string(event.message)
      // Routine extension startup announcements are not actionable.
      if (/^Ponytail loaded: (lite|full|ultra|off)$/.test(message)) return
      noticeListener?.(message)
    } else if (
      method === 'set_editor_text' &&
      sessionId &&
      !runtimeState.currentRun.bindingUncertain &&
      !runtimeState.currentRun.needsReconcile &&
      store.connection === 'connected'
    )
      store.updateSession(sessionId, { draft: string(event.text) })
    return
  }
  // pi replaces the session before its RPC acknowledgement; do not route replacement
  // events to the old desktop session while that transition is in progress.
  if (
    !sessionId ||
    runtimeState.currentRun.bindingUncertain ||
    runtimeState.currentRun.needsReconcile ||
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
    const run = runtimeState.currentRun
    const bindingVersion = run.bindingVersion
    useWorkspace.setState({ runningSessionId: null })
    void syncSession(sessionId).catch((error) => {
      if (
        runtimeState.currentRun === run &&
        run.bindingVersion === bindingVersion &&
        useWorkspace.getState().connection !== 'connecting'
      )
        useWorkspace.setState({ connectionError: errorText(error) })
    })
  }
}

export async function extensionResponse(
  id: string,
  response: Record<string, unknown>,
  runId?: string,
  sessionId?: string | null,
) {
  if (
    (runId && runtimeState.currentRun?.id !== runId) ||
    (sessionId && runtimeState.currentRun?.sessionId !== sessionId)
  )
    throw new Error(t('errors.sessionChanged'))
  await request({ type: 'extension_ui_response', id, ...response })
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
    prefill: typeof req.prefill === 'string' ? req.prefill : undefined,
    placeholder: typeof req.placeholder === 'string' ? req.placeholder : undefined,
  }
}
