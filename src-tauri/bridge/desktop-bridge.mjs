// Loaded only by Pi Desktop. No SDK private imports and no user package writes.
const VERSION = 1;
const STATE = 'pi-desktop-mode-v1';
const RECEIPT = 'pi-desktop-receipt-v1';
const CONTEXT = 'pi-desktop-context-v1';
const READ_TOOLS = new Set(['read', 'grep', 'find', 'ls']);

export default function desktopBridge(pi) {
  const isPlan = (value) => value?.builtin === 'plan' || value?.readOnly === true;
  let mode;
  let baseline = [];
  let prepared;
  let contextId;
  let receipts = [];
  let userIndex = 0;

  const emit = (ctx, value) => ctx.ui.notify(JSON.stringify({ protocol: "pi-desktop-bridge-v1", ...value }), "info");
  const builtinRead = (tool) => READ_TOOLS.has(tool.name) && tool.sourceInfo?.path === `builtin:${tool.name}`;
  const safeTools = () => pi.getAllTools().filter(builtinRead).map((tool) => tool.name);
  const persistMode = () => pi.appendEntry(STATE, { mode, baseline });
  async function checkBackgroundWork() {
    if (!pi.getAllTools().some((tool) => tool.name === 'subagent')) return;
    const requestId = crypto.randomUUID();
    const reply = await new Promise((resolve) => {
      const unsubscribe = pi.events.on(`subagents:rpc:v1:reply:${requestId}`, (value) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(value);
      });
      const timer = setTimeout(() => { unsubscribe(); resolve(null); }, 3000);
      pi.events.emit('subagents:rpc:v1:request', { version: 1, requestId, method: 'status', params: {} });
    });
    if (!reply?.success || typeof reply.data?.fleet?.totalActive !== 'number') throw new Error('capability.backgroundUnknown');
    if (reply.data.fleet.totalActive > 0) throw new Error('capability.busy');
  }
  function enforce() {
    if (isPlan(mode)) pi.setActiveTools(safeTools());
  }
  function restore(ctx) {
    // The active branch, rather than all entries, owns mode and receipt state.
    mode = undefined;
    baseline = [];
    prepared = undefined;
    contextId = undefined;
    receipts = [];
    userIndex = 0;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === 'custom' && entry.customType === STATE) {
        mode = entry.data.mode;
        baseline = entry.data.baseline || [];
      }
      if (entry.type === 'custom' && entry.customType === RECEIPT) receipts.push(entry.data);
      if (entry.type === 'message' && entry.message.role === 'user') userIndex++;
    }
    enforce();
  }
  const status = () => ({ version: VERSION, plan: isPlan(mode), mode,
    tools: pi.getActiveTools(), receipts, preparedId: prepared?.id,
    unavailableTargets: pi.getAllTools().some((tool) => tool.name === 'subagent') ? [] : ['review-loop'] });
  const origin = (command) => command.sourceInfo?.path || command.sourceInfo?.source || '';
  function validateTarget(target) {
    if (target.name === 'review-loop' && !pi.getAllTools().some((tool) => tool.name === 'subagent'))
      throw new Error('capability.unavailable');
    const matches = pi.getCommands().filter((command) => command.name === target.name);
    const effective = matches.find((c) => c.source === 'extension') ||
      (target.name.startsWith('skill:') && matches.find((c) => c.source === 'skill')) ||
      matches.find((c) => c.source === 'prompt');
    if (!effective || effective.source !== target.source || origin(effective) !== target.origin)
      throw new Error('capability.unavailable');
  }
  function addReceipt(snapshot, index, sourceTimestamp) {
    const receipt = { id: snapshot.id, body: snapshot.body, timestamp: snapshot.createdAt,
      ...(index === undefined ? {} : { userIndex: index }),
      ...(sourceTimestamp === undefined ? {} : { sourceTimestamp }),
      selection: { mode: snapshot.mode, task: snapshot.task } };
    pi.appendEntry(RECEIPT, receipt);
    receipts.push(receipt);
    return receipt;
  }
  pi.on('session_start', (_event, ctx) => restore(ctx));
  // A retained process can switch sessions without being reloaded.
  pi.on('session_tree', (_event, ctx) => restore(ctx));

  pi.registerCommand('desktop-bridge', {
    description: 'Pi Desktop capability transport v1',
    handler: async (args, ctx) => {
      let call;
      try {
        call = JSON.parse(args);
        if (typeof call.id !== 'string' || call.version !== VERSION) throw new Error('capability.bridgeUnavailable');
        if (ctx.mode !== 'rpc') throw new Error('capability.bridgeUnavailable');
        if (call.op === 'status') {
          enforce();
        } else if (call.op === 'mode') {
          if (!ctx.isIdle()) throw new Error('capability.busy');
          const next = call.mode;
          if (next && (next.scope !== 'session' || next.target || !next.prompt?.trim())) throw new Error('capability.invalid');
          if (isPlan(next) && !safeTools().length) throw new Error('capability.noReadTools');
          if (isPlan(next) && !isPlan(mode)) await checkBackgroundWork();
          if (isPlan(next) && !isPlan(mode)) baseline = pi.getActiveTools().map((name) => ({ name, origin: pi.getAllTools().find((tool) => tool.name === name)?.sourceInfo?.path }));
          if (isPlan(mode) && !isPlan(next)) {
            const all = new Map(pi.getAllTools().map((tool) => [tool.name, tool.sourceInfo?.path]));
            pi.setActiveTools(baseline.filter((entry) => typeof entry === 'string' ? all.get(entry) === `builtin:${entry}` : all.get(entry.name) === entry.origin).map((entry) => typeof entry === 'string' ? entry : entry.name));
            baseline = [];
          }
          mode = next || undefined;
          prepared = undefined;
          enforce();
          persistMode();
        } else if (call.op === 'prepare') {
          if (!ctx.isIdle()) throw new Error('capability.busy');
          const next = call.submission;
          if (!next || typeof next.id !== 'string' || typeof next.body !== 'string') throw new Error('capability.invalid');
          if (receipts.some((receipt) => receipt.id === next.id)) {
            emit(ctx, { type: 'response', id: call.id, success: true, data: { ...status(), accepted: true } });
            return;
          }
          if (JSON.stringify(next.mode || null) !== JSON.stringify(mode || null)) throw new Error('capability.modeChanged');
          const task = next.task;
          if (task?.target) validateTarget(task.target);
          if (isPlan(mode) && (task?.modifies || task?.target || /^\s*\/[\w:.-]+/.test(next.body)))
            throw new Error('capability.planConflict');
          prepared = { ...next, createdAt: Date.now(), started: false };
          enforce();
        } else if (call.op === 'finish') {
          if (prepared?.id === call.requestId && !prepared.started) {
            if (!receipts.some((r) => r.id === prepared.id)) addReceipt(prepared);
            prepared = undefined;
          }
        } else if (call.op === 'cancel') {
          if (prepared?.id === call.requestId && !prepared.started) prepared = undefined;
        } else throw new Error('capability.invalid');
        emit(ctx, { type: 'response', id: call.id, success: true, data: status() });
      } catch (error) {
        // The native transport deliberately has a different id. An extension
        // command being 'handled' must never be mistaken for operation success.
        if (call?.id) emit(ctx, { type: 'response', id: call.id, success: false, error: error.message });
      }
    },
  });
  pi.on('before_agent_start', (event) => {
    enforce();
    const snapshot = event.messageType === 'user' ? prepared : undefined;
    if (snapshot) snapshot.started = true;
    contextId = snapshot?.id || (mode ? `mode-${Date.now()}` : undefined);
    const instructions = [mode?.prompt, snapshot?.task?.prompt].filter(Boolean).join('\n\n');
    if (!instructions) return;
    return { message: { customType: CONTEXT, content: instructions, display: false,
      details: { requestId: contextId } } };
  });
  pi.on('message_start', (event) => {
    if (event.message.role !== 'user') return;
    if (prepared?.started) {
      if (!receipts.some((r) => r.id === prepared.id)) addReceipt(prepared, userIndex, event.message.timestamp);
      prepared = undefined;
    }
    userIndex++;
  });
  pi.on('context', (event) => ({ messages: event.messages.filter((message) =>
    message.role !== 'custom' || message.customType !== CONTEXT || message.details?.requestId === contextId) }));
  pi.on('tool_call', (event) => {
    if (!isPlan(mode)) return;
    const tool = pi.getAllTools().find((candidate) => candidate.name === event.toolName);
    if (!tool || !builtinRead(tool)) return { block: true, reason: 'Plan mode permits only built-in read/search tools. Exit Plan mode to make changes.' };
  });
}
