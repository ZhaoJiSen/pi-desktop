// @vitest-environment happy-dom
import { act, createElement as h, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtensionRequest } from '../../src/types'
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), navigate: vi.fn(), focus: vi.fn() }))
vi.mock('../../src/router/hooks', () => ({ useCurrentPage: () => 'chat' }))
vi.mock('../../src/router/navigation', () => ({ navigateToPage: mocks.navigate }))
vi.mock('../../src/hooks/useAppForeground', () => ({ useAppForeground: () => true }))
vi.mock('../../src/lib/notifications', () => ({
  focusApplication: mocks.focus,
  listenNotificationActions: async () => ({ unregister: async () => {} }),
  requestQuestionAttention: vi.fn(),
  showQuestionNotification: vi.fn(),
  reportNotificationError: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, Channel: class {} }))
vi.mock('../../src/store/workspace', async (original) => ({
  ...(await original<typeof import('../../src/store/workspace')>()),
  isDesktop: true,
}))
vi.mock('motion/react', () => {
  const element =
    (tag: string) =>
    ({
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: Record<string, unknown>) =>
      h(tag, props)
  return {
    useReducedMotion: () => true,
    motion: {
      section: element('section'),
      p: element('p'),
      span: element('span'),
      div: element('div'),
      aside: element('aside'),
      create:
        (component: React.ElementType) =>
        ({
          initial: _initial,
          animate: _animate,
          transition: _transition,
          ...props
        }: Record<string, unknown>) =>
          h(component, props),
    },
  }
})
vi.mock('../../src/components/conversation/MessageView', () => ({
  MessageView: ({ message }: { message: { blocks: { text: string }[] } }) =>
    h('p', null, message.blocks[0]?.text),
}))
vi.mock('@heroui/react', async (original) => ({
  ...(await original<typeof import('@heroui/react')>()),
  Button: ({
    children,
    onPress,
    isDisabled,
    isPending: _pending,
    ...props
  }: {
    children?: ReactNode
    onPress?: () => void
    isDisabled?: boolean
    isPending?: boolean
  }) => h('button', { type: 'button', ...props, disabled: isDisabled, onClick: onPress }, children),
  ScrollShadow: ({
    children,
    isEnabled: _enabled,
    initial: _initial,
    animate: _animate,
    transition: _transition,
    ...props
  }: {
    children?: ReactNode
    [key: string]: unknown
  }) => h('div', props, children),
  Spinner: () => h('span'),
}))
import { QuestionProvider } from '../../src/components/conversation/QuestionContext'
import { Conversation } from '../../src/components/Conversation'
import { QuestionNotifications } from '../../src/components/QuestionNotifications'
import { connectSession } from '../../src/lib/desktop/connections'
import { sendPrompt } from '../../src/lib/desktop/prompts'
import { syncSession } from '../../src/lib/desktop/requests'
import { handleEvent, decodeExtensionRequest } from '../../src/lib/desktop/events'
import { runtimeState } from '../../src/lib/desktop/runtimeState'
import { useWorkspace } from '../../src/store/workspace'
import { createPreviewSessions, previewProjects } from '../../src/lib/fixtures'
import { normalizeMessages } from '../../src/lib/rpc'
import type {
  Capability,
  CapabilityBridgeState,
  CapabilitySubmission,
} from '../../src/lib/capabilities/types'
let root: Root, container: HTMLDivElement
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.invoke.mockReset().mockResolvedValue(undefined)
  mocks.navigate.mockReset().mockResolvedValue(undefined)
  mocks.focus.mockReset().mockResolvedValue(undefined)
  runtimeState.projectConnections.clear()
  runtimeState.connecting = null
  const session = createPreviewSessions()[0]!
  session.id = 'question-session'
  session.draft = 'Do not change this draft'
  session.messages = [
    {
      id: 'before',
      role: 'assistant',
      blocks: [{ type: 'text', text: 'Before question' }],
      timestamp: 1,
    },
  ]
  useWorkspace.setState({
    sessions: [session],
    projects: previewProjects,
    activeSessionId: session.id,
    connection: 'connected',
    runningSessionId: null,
    piBusyRuns: [],
    commands: [],
    capabilityBridge: null,
    language: 'en',
    piUpdating: false,
  })
  runtimeState.currentRun = {
    id: 'question-run',
    sessionId: session.id,
    bindingVersion: 0,
    path: '/project',
    executable: 'pi',
    packages: [],
  }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(h(QuestionProvider, null, h(Conversation, { onProject: () => {} }))),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  runtimeState.currentRun = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
async function emit(request: Partial<ExtensionRequest> = {}) {
  await act(async () =>
    handleEvent({
      runId: 'question-run',
      event: {
        type: 'extension_ui_request',
        id: 'question',
        method: 'select',
        title: 'Which area?',
        options: [
          'API contracts',
          'Long option with full instructions and paths src/features/conversation/entry.tsx',
        ],
        ...request,
      },
    }),
  )
}
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === text)
  expect(button, text).toBeDefined()
  await act(async () => button!.click())
}
async function submit() {
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
}
async function type(value: string) {
  const input = container.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
describe('questions inside the conversation', () => {
  it.each(['file', 'extension', 'consumed extension'] as const)(
    'preserves an answered question when bridge receipts replace the %s submission text',
    async (kind) => {
      const task: Capability = {
        id: 'test-review',
        name: 'Custom review',
        alias: 'custom-review',
        description: '',
        icon: 'review',
        prompt: '',
        scope: 'once',
        enabled: true,
        pinned: false,
        modifies: false,
        target: { name: 'custom-review', source: 'extension', origin: 'test' },
      }
      const bridge: CapabilityBridgeState = { version: 1, plan: false, tools: [], receipts: [] }
      let submission!: CapabilitySubmission
      let wireText = ''
      let localId = ''
      const consumed = kind === 'consumed extension'
      await act(async () => {
        const store = useWorkspace.getState()
        useWorkspace.setState({
          capabilityBridge: bridge,
          capabilityPreferences: { ...store.capabilityPreferences, items: [task] },
          commands: [
            {
              name: 'desktop-bridge',
              source: 'extension',
              description: 'Pi Desktop capability transport v1',
            },
          ],
        })
        store.updateSession('question-session', {
          messages: [],
          draft: 'Review',
          capabilities: kind === 'file' ? undefined : { task },
          pendingCapabilitySend: undefined,
        })
      })
      mocks.invoke.mockImplementation(async (name, args) => {
        if (name !== 'pi_request') return []
        switch (args.command.type) {
          case 'desktop_bridge': {
            const call = args.command.call
            if (call.op === 'prepare') submission = call.submission
            if (call.op === 'finish')
              bridge.receipts = [
                {
                  id: submission.id,
                  body: submission.body,
                  timestamp: 5,
                  ...(consumed ? {} : { userIndex: 0, sourceTimestamp: 10 }),
                  selection: { task: submission.task },
                },
              ]
            return bridge
          }
          case 'prompt':
            wireText = args.command.message
            localId = useWorkspace.getState().sessions[0]!.messages[0].id
            handleEvent({
              runId: 'question-run',
              event: {
                type: 'extension_ui_request',
                id: 'question',
                method: 'confirm',
                title: 'May I review?',
              },
            })
            return { disposition: consumed ? 'handled' : 'queued' }
          case 'get_state':
            return {
              sessionFile: '/tmp/questions.jsonl',
              thinkingLevel: 'medium',
              isStreaming: false,
            }
          case 'get_messages':
            return {
              messages: [
                ...(consumed ? [] : [{ role: 'user', content: wireText, timestamp: 10 }]),
                { role: 'assistant', content: 'Review response', timestamp: 20 },
              ],
            }
          default:
            return {}
        }
      })
      await act(async () => {
        expect(
          await sendPrompt(
            kind === 'file'
              ? [
                  {
                    id: 'file',
                    name: 'notes.txt',
                    kind: 'text',
                    mimeType: 'text/plain',
                    data: 'Private file contents',
                  },
                ]
              : [],
          ),
          useWorkspace.getState().connectionError || '',
        ).toBe(true)
      })
      expect(wireText).not.toBe(submission.body)
      expect(container.querySelector('[data-status="pending"]')).not.toBeNull()
      await submit()
      for (let count = 0; count < 2; count++) {
        await act(async () => {
          await syncSession('question-session')
        })
        expect(useWorkspace.getState().sessions[0]!.messages[0]).toMatchObject({
          id: localId,
          blocks: [{ type: 'text', text: 'Review' }],
        })
        expect(container.querySelector('[data-status="answered"]')?.textContent).toContain(
          'May I review?',
        )
        const text = container.textContent!
        expect(text.indexOf('May I review?')).toBeLessThan(text.indexOf('Review response'))
        expect(text).not.toContain('Private file contents')
        expect(text).not.toContain('/custom-review')
      }
    },
  )
  it('keeps an answered pre-assistant question attached to its optimistic user message across repeated syncs', async () => {
    await act(async () => {
      useWorkspace.setState({ runningSessionId: null, capabilityBridge: null })
      useWorkspace.getState().updateSession('question-session', {
        messages: [],
        draft: 'Ask before starting',
        capabilities: undefined,
        pendingCapabilitySend: undefined,
      })
    })
    mocks.invoke.mockImplementation(async (name, args) => {
      if (name !== 'pi_request') return []
      switch (args.command.type) {
        case 'prompt':
          handleEvent({
            runId: 'question-run',
            event: {
              type: 'extension_ui_request',
              id: 'question',
              method: 'confirm',
              title: 'May I start?',
            },
          })
          return { disposition: 'queued' }
        case 'get_state':
          return {
            sessionFile: '/tmp/questions.jsonl',
            thinkingLevel: 'medium',
            isStreaming: false,
          }
        case 'get_messages':
          return {
            messages: [
              { role: 'user', content: 'Ask before starting', timestamp: 10 },
              { role: 'assistant', content: 'Starting now', timestamp: 20 },
            ],
          }
        default:
          return {}
      }
    })
    await act(async () => {
      expect(await sendPrompt([]), useWorkspace.getState().connectionError || '').toBe(true)
    })
    const local = useWorkspace.getState().sessions[0]!.messages[0]
    expect(local.timestamp).not.toBe(10)
    // History can refresh while Pi is still waiting for the confirmation.
    await act(async () => {
      await syncSession('question-session')
    })
    expect(useWorkspace.getState().sessions[0]!.messages[0]).toMatchObject({
      id: local.id,
      timestamp: 10,
    })
    expect(container.querySelector('[data-status="pending"]')?.textContent).toContain(
      'May I start?',
    )
    const pendingText = container.textContent!
    expect(pendingText.indexOf('Ask before starting')).toBeLessThan(
      pendingText.indexOf('May I start?'),
    )
    expect(pendingText.indexOf('May I start?')).toBeLessThan(pendingText.indexOf('Starting now'))
    await submit()
    expect(container.querySelector('[data-status="answered"]')).not.toBeNull()
    for (let count = 0; count < 2; count++) {
      await act(async () => {
        await syncSession('question-session')
      })
      expect(container.querySelector('[data-status="answered"]')?.textContent).toContain(
        'May I start?',
      )
      const text = container.textContent!
      expect(text.indexOf('Ask before starting')).toBeLessThan(text.indexOf('May I start?'))
      expect(text.indexOf('May I start?')).toBeLessThan(text.indexOf('Starting now'))
      expect(useWorkspace.getState().sessions[0]!.messages[0].timestamp).toBe(10)
      expect(useWorkspace.getState().sessions[0]!.messages[0].id).toBe(local.id)
    }
  })
  it('keeps an answered Card after its tool call when authoritative history replaces every UI ID', async () => {
    const raw = [
      { role: 'user', content: 'Ask me a question', timestamp: 1 },
      {
        role: 'assistant',
        timestamp: 2,
        content: [
          { type: 'text', text: 'Before question' },
          { type: 'toolCall', id: 'ask-1', name: 'ask_user_question', arguments: {} },
        ],
      },
    ]
    await act(async () =>
      useWorkspace.getState().updateSession('question-session', {
        messages: normalizeMessages(raw).map((item, index) => ({
          ...item,
          id: `temporary-${index}`,
        })),
      }),
    )
    await emit()
    await click('API contracts')
    await submit()
    await act(async () =>
      useWorkspace.getState().updateSession('question-session', {
        messages: normalizeMessages([
          ...raw,
          {
            role: 'toolResult',
            toolCallId: 'ask-1',
            content: [{ type: 'text', text: 'API contracts' }],
          },
          { role: 'assistant', content: 'After answer', timestamp: 3 },
        ]),
      }),
    )
    const text = container.textContent!
    expect(text.indexOf('Ask me a question')).toBeLessThan(text.indexOf('Before question'))
    expect(text.indexOf('Before question')).toBeLessThan(text.indexOf('Which area?'))
    expect(text.indexOf('Which area?')).toBeLessThan(text.indexOf('After answer'))
  })
  it('keeps answered questions with paginated history instead of moving them ahead of visible messages', async () => {
    await emit()
    await click('API contracts')
    await submit()
    await act(async () =>
      useWorkspace.getState().updateSession('question-session', {
        messages: [
          ...useWorkspace.getState().sessions[0]!.messages,
          ...Array.from({ length: 100 }, (_, index) => ({
            id: `later-${index}`,
            role: 'assistant' as const,
            timestamp: index + 2,
            blocks: [{ type: 'text' as const, text: `Later reply ${index}` }],
          })),
        ],
      }),
    )
    expect(container.querySelector('.chat-question')).toBeNull()
    await click('Show earlier messages')
    expect(container.querySelector('.chat-question')).not.toBeNull()
    expect(container.textContent!.indexOf('Before question')).toBeLessThan(
      container.textContent!.indexOf('Which area?'),
    )
    expect(container.textContent!.indexOf('Which area?')).toBeLessThan(
      container.textContent!.indexOf('Later reply 0'),
    )
  })
  it.each([
    ['new_session', true],
    ['new_session', false],
    ['switch_session', true],
    ['switch_session', false],
  ] as const)(
    'answers a %s confirmation from the old session without changing the selected target (confirm=%s)',
    async (commandType, confirmed) => {
      const owner = useWorkspace.getState().sessions[0]!
      const target = {
        ...owner,
        id: 'switch-target',
        messages: [
          {
            ...owner.messages[0]!,
            blocks: [{ type: 'text' as const, text: 'Destination history' }],
          },
        ],
        piSessionFile: commandType === 'switch_session' ? '/tmp/saved-target.jsonl' : undefined,
      }
      const project = useWorkspace.getState().projects.find((item) => item.id === owner.projectId)!
      const run = runtimeState.currentRun!
      run.path = project.path
      run.executable = useWorkspace.getState().piExecutable
      runtimeState.projectConnections.set(project.path, run)
      let release!: (value: object) => void
      mocks.invoke.mockImplementation(async (name, args) => {
        if (name !== 'pi_request') return []
        if (args.command.type === commandType) {
          handleEvent({
            runId: run.id,
            event: {
              type: 'extension_ui_request',
              id: 'switch-confirm',
              method: 'confirm',
              title: 'Leave this session?',
            },
          })
          return new Promise((resolve) => {
            release = resolve
          })
        }
        switch (args.command.type) {
          case 'get_state':
            return { sessionFile: '/tmp/target.jsonl', thinkingLevel: 'medium', isStreaming: false }
          case 'get_available_models':
            return { models: [] }
          case 'get_commands':
            return { commands: [] }
          case 'get_available_thinking_levels':
            return { levels: ['medium'] }
          case 'get_messages':
            return { messages: [] }
          default:
            return {}
        }
      })
      let switching!: Promise<void>
      await act(async () => {
        root.render(
          h(
            QuestionProvider,
            null,
            h(Conversation, { onProject: () => {} }),
            h(QuestionNotifications),
          ),
        )
        useWorkspace.setState({ sessions: [owner, target], activeSessionId: target.id })
        switching = connectSession(target.id)
      })
      expect(useWorkspace.getState().connection).toBe('connecting')
      expect(run.sessionId).toBe(owner.id)
      expect(container.querySelector('.chat-question')?.textContent).toContain(
        'Leave this session?',
      )
      await click('View question')
      expect(mocks.focus).toHaveBeenCalledOnce()
      expect(mocks.navigate).toHaveBeenCalledWith('chat')
      expect(document.activeElement).toBe(container.querySelector('.chat-question'))
      expect(useWorkspace.getState().activeSessionId).toBe(target.id)
      if (confirmed) await submit()
      else await click('Decline')
      expect(mocks.invoke).toHaveBeenCalledWith('pi_request', {
        runId: run.id,
        command: { type: 'extension_ui_response', id: 'switch-confirm', confirmed },
      })
      await act(async () => {
        release(confirmed ? {} : { cancelled: true })
        await switching
      })
      expect(useWorkspace.getState().connection).toBe('connected')
      expect(useWorkspace.getState().activeSessionId).toBe(confirmed ? target.id : owner.id)
      expect(run.sessionId).toBe(confirmed ? target.id : owner.id)
      expect(useWorkspace.getState().sessions.find((item) => item.id === owner.id)?.draft).toBe(
        owner.draft,
      )
    },
  )
  it('opens and focuses custom input, preserves it across choices, and sends typed text instead of the sentinel', async () => {
    await emit({ options: ['API contracts', '2. Type something.'] })
    await click('Write your own answer')
    const input = container.querySelector('textarea')!
    expect(document.activeElement).toBe(input)
    await submit()
    expect(mocks.invoke).not.toHaveBeenCalled()
    await type('只调整布局\n保留原有接口')
    await click('API contracts')
    expect(container.querySelector('textarea')).toBeNull()
    await click('Write your own answer')
    expect(container.querySelector('textarea')?.value).toBe('只调整布局\n保留原有接口')
    mocks.invoke.mockRejectedValueOnce(new Error('Connection interrupted'))
    await submit()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Connection interrupted',
    )
    expect(container.querySelector('textarea')?.value).toBe('只调整布局\n保留原有接口')
    await submit()
    expect(mocks.invoke.mock.calls.at(-1)?.[1].command).toEqual({
      type: 'extension_ui_response',
      id: 'question',
      value: '只调整布局\n保留原有接口',
    })
    expect(container.querySelector('[data-status="answered"]')?.textContent).toContain('只调整布局')
    expect(useWorkspace.getState().sessions[0]!.draft).toBe('Do not change this draft')
  })
  it('does not treat an ordinary Other option as a custom-answer protocol', async () => {
    await emit({ options: ['API contracts', 'Other'] })
    await click('Other')
    expect(container.querySelector('textarea')).toBeNull()
    await submit()
    expect(mocks.invoke.mock.calls.at(-1)?.[1].command.value).toBe('Other')
  })
  it('returns the exact selected option once, keeps draft and anchors answer before following messages', async () => {
    await emit()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    await submit()
    expect(mocks.invoke).not.toHaveBeenCalled()
    await click('API contracts')
    await submit()
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('pi_request', {
      runId: 'question-run',
      command: { type: 'extension_ui_response', id: 'question', value: 'API contracts' },
    })
    expect(container.querySelector('[data-status="answered"]')?.textContent).toContain(
      'API contracts',
    )
    expect(useWorkspace.getState().sessions[0]!.draft).toBe('Do not change this draft')
    await act(async () =>
      useWorkspace.getState().updateSession('question-session', {
        messages: [
          ...useWorkspace.getState().sessions[0]!.messages,
          {
            id: 'after',
            role: 'assistant',
            blocks: [{ type: 'text', text: 'After answer' }],
            timestamp: 2,
          },
        ],
      }),
    )
    expect(container.textContent!.indexOf('Before question')).toBeLessThan(
      container.textContent!.indexOf('Which area?'),
    )
    expect(container.textContent!.indexOf('Which area?')).toBeLessThan(
      container.textContent!.indexOf('After answer'),
    )
  })
  it('prevents duplicate submission while Pi is acknowledging an answer', async () => {
    await emit()
    await click('API contracts')
    let resolve!: () => void
    mocks.invoke.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done
        }),
    )
    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(mocks.invoke).toHaveBeenCalledOnce()
    await act(async () => resolve())
    expect(container.querySelector('[data-status="answered"]')).not.toBeNull()
  })
  it('rejects a stale answer even before a new session has published its state', async () => {
    await emit()
    await click('API contracts')
    runtimeState.currentRun!.sessionId = 'new-session'
    await submit()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })
  it('retains edited answer after a failed response and session navigation', async () => {
    await emit({ method: 'editor', prefill: 'Existing notes' })
    await type('中文补充\nKeep the API stable')
    mocks.invoke.mockRejectedValueOnce(new Error('Transport unavailable'))
    await submit()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Transport unavailable',
    )
    expect(container.querySelector('textarea')?.value).toBe('中文补充\nKeep the API stable')
    await act(async () => useWorkspace.setState({ activeSessionId: 'other' }))
    expect(container.querySelector('.chat-question')).toBeNull()
    await act(async () => useWorkspace.setState({ activeSessionId: 'question-session' }))
    expect(container.querySelector('textarea')?.value).toBe('中文补充\nKeep the API stable')
    await submit()
    expect(mocks.invoke.mock.calls.at(-1)?.[1].command.value).toBe('中文补充\nKeep the API stable')
  })
  it('keeps queued questions inactive and uses confirm false when declining', async () => {
    await emit({ method: 'confirm' })
    await emit({ id: 'second', method: 'input', title: 'Follow up' })
    expect(container.querySelector('textarea')?.disabled).toBe(true)
    await click('Decline')
    expect(mocks.invoke.mock.calls[0]?.[1].command).toMatchObject({
      id: 'question',
      confirmed: false,
    })
    expect(container.querySelector('textarea')?.disabled).toBe(false)
  })
  it('expires from receipt time and deduplicates repeated requests', async () => {
    vi.useFakeTimers()
    await emit({ timeout: 1000 })
    await emit({ timeout: 1000 })
    expect(container.querySelectorAll('.chat-question')).toHaveLength(1)
    await act(async () => vi.advanceTimersByTime(1000))
    expect(container.querySelector('[data-status="expired"]')).not.toBeNull()
    expect(mocks.invoke.mock.calls[0]?.[1].command).toMatchObject({
      id: 'question',
      cancelled: true,
    })
  })
  it('closes stale requests on runtime exit instead of sending to another Pi process', async () => {
    await emit()
    runtimeState.currentRun = { ...runtimeState.currentRun!, id: 'another-run' }
    await act(async () => useWorkspace.setState({ connection: 'error' }))
    expect(container.querySelector('[data-status="unavailable"]')).not.toBeNull()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })
  it('keeps editor prefill and placeholder during decoding', () => {
    expect(
      decodeExtensionRequest({ id: 'e', method: 'editor', prefill: 'keep', placeholder: 'answer' }),
    ).toMatchObject({ prefill: 'keep', placeholder: 'answer' })
  })
})
