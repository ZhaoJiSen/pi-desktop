// @vitest-environment happy-dom
import { act, createElement as h, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtensionRequest } from '../../src/types'
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
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
      create: (component: unknown) => component,
    },
  }
})
vi.mock('../../src/components/conversation/MessageView', () => ({
  MessageView: ({ message }: { message: { blocks: { text: string }[] } }) =>
    h('p', null, message.blocks[0]?.text),
}))
vi.mock('@heroui/react', () => ({
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
import { handleEvent, decodeExtensionRequest } from '../../src/lib/desktop/events'
import { runtimeState } from '../../src/lib/desktop/runtimeState'
import { useWorkspace } from '../../src/store/workspace'
import { createPreviewSessions, previewProjects } from '../../src/lib/fixtures'
let root: Root, container: HTMLDivElement
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.invoke.mockReset().mockResolvedValue(undefined)
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
