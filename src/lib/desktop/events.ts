import type { ExtensionRequest, RuntimeEvent, ThinkingLevel } from '../../types'
import { useWorkspace } from '../../store/workspace'
import { t } from '../i18n'
import { errorText, list, record, string } from '../utils'
import { request, syncSession } from './requests'
import { runtimeState } from './runtimeState'

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

export function handleEvent({ runId, event }: RuntimeEvent) {
  if (event.type === 'runtime_exit') {
    for (const [path, run] of runtimeState.projectConnections)
      if (run.id === runId) runtimeState.projectConnections.delete(path)
  }
  if (runtimeState.currentRun?.id !== runId) return
  const sessionId = runtimeState.currentRun.sessionId
  const store = useWorkspace.getState()
  if (event.type === 'runtime_exit') {
    runtimeState.currentRun = null
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

export async function extensionResponse(id: string, response: Record<string, unknown>) {
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
  }
}
