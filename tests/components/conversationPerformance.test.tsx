// @vitest-environment happy-dom
import { act, createElement as h, memo, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ messageRender: vi.fn() }))
vi.mock('motion/react', () => ({ motion: { create: (component: unknown) => component } }))
vi.mock('@heroui/react', () => ({
  Button: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) =>
    h('button', { onClick: onPress }, children),
  ScrollShadow: ({
    children,
    ref,
    onScroll,
    className,
  }: {
    children?: ReactNode
    ref: React.Ref<HTMLDivElement>
    onScroll?: () => void
    className?: string
  }) => h('div', { ref, onScroll, className }, children),
  Spinner: () => null,
}))
vi.mock('../../src/components/TextShimmer', () => ({
  TextShimmer: ({ children }: { children?: ReactNode }) => children,
}))
vi.mock('../../src/components/conversation/ToolCall', () => ({ toolStartsOpen: () => false }))
vi.mock('../../src/components/conversation/QuestionContext', () => ({
  useQuestions: () => ({ questions: [] }),
}))
vi.mock('../../src/components/conversation/MessageView', () => ({
  MessageView: memo(({ message }: { message: { id: string; blocks: { text: string }[] } }) => {
    mocks.messageRender(message.id)
    return h('p', { 'data-message': message.id }, message.blocks[0]?.text)
  }),
}))
import { Conversation } from '../../src/components/Conversation'
import { useWorkspace } from '../../src/store/workspace'
import { selectSessionSummaries, useSessionDetails } from '../../src/store/sessionSelectors'
import { makeSession } from '../../src/lib/fixtures'
import type { Message } from '../../src/types'

let root: Root, container: HTMLDivElement
const history = (count: number): Message[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `message-${i}`,
    role: 'assistant',
    timestamp: i,
    blocks: [{ type: 'text', text: `Reply ${i}` }],
  }))
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const session = { ...makeSession('project'), id: 'active', messages: history(2000) }
  useWorkspace.setState({
    sessions: [session],
    activeSessionId: session.id,
    runningSessionId: null,
    language: 'en',
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  mocks.messageRender.mockClear()
})
afterEach(async () => {
  await act(async () => root.unmount())
  useWorkspace.flushPersistence()
  container.remove()
  vi.unstubAllGlobals()
})

it('opens a 2,000-message conversation by rendering only the latest 80, then loads history without moving the reading position', async () => {
  await act(async () => root.render(h(Conversation, { onProject: () => {} })))
  expect(container.querySelectorAll('[data-message]')).toHaveLength(80)
  expect(container.querySelector('[data-message]')?.getAttribute('data-message')).toBe(
    'message-1920',
  )
  const scroll = container.querySelector<HTMLDivElement>('.conversation')!
  Object.defineProperty(scroll, 'scrollHeight', {
    configurable: true,
    get: () => container.querySelectorAll('[data-message]').length * 100,
  })
  scroll.scrollTop = 120
  await act(async () => container.querySelector('button')!.click())
  expect(container.querySelectorAll('[data-message]')).toHaveLength(160)
  expect(scroll.scrollTop).toBe(8120)
  expect(mocks.messageRender).toHaveBeenCalledTimes(160)
  await act(async () =>
    useWorkspace
      .getState()
      .appendEvent('active', {
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'new' },
      }),
  )
  expect(mocks.messageRender).toHaveBeenCalledTimes(161)
  expect(scroll.scrollTop).toBe(8120)
})

it('does not render history on draft changes or refresh sidebar and input settings on a streamed token', async () => {
  const sidebar = vi.fn(),
    composer = vi.fn()
  function SidebarProbe() {
    sidebar(useWorkspace(selectSessionSummaries))
    return null
  }
  function ComposerProbe() {
    composer(useSessionDetails())
    return null
  }
  await act(async () =>
    root.render(
      h('div', null, h(Conversation, { onProject: () => {} }), h(SidebarProbe), h(ComposerProbe)),
    ),
  )
  mocks.messageRender.mockClear()
  sidebar.mockClear()
  composer.mockClear()
  await act(async () => useWorkspace.getState().updateSession('active', { draft: 'typing' }))
  expect(mocks.messageRender).not.toHaveBeenCalled()
  expect(sidebar).not.toHaveBeenCalled()
  expect(composer).toHaveBeenCalledOnce()
  composer.mockClear()
  await act(async () =>
    useWorkspace
      .getState()
      .appendEvent('active', {
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'new' },
      }),
  )
  expect(mocks.messageRender).toHaveBeenCalledOnce()
  expect(sidebar).not.toHaveBeenCalled()
  expect(composer).not.toHaveBeenCalled()
  await act(async () =>
    useWorkspace.getState().updateSession('active', { title: 'Renamed', pinned: true }),
  )
  expect(sidebar).toHaveBeenCalledOnce()
  expect(sidebar.mock.calls[0][0][0]).toMatchObject({ title: 'Renamed', pinned: true })
})

it('applies the history limit to an asynchronously restored thread and resets it when switching sessions', async () => {
  const original = useWorkspace.getState().sessions[0]
  useWorkspace.getState().updateSession('active', { messages: [] })
  await act(async () => root.render(h(Conversation, { onProject: () => {} })))
  await act(async () =>
    useWorkspace.getState().updateSession('active', { messages: original.messages }),
  )
  expect(container.querySelectorAll('[data-message]')).toHaveLength(80)
  await act(async () => container.querySelector('button')!.click())
  expect(container.querySelectorAll('[data-message]')).toHaveLength(160)
  const other = { ...original, id: 'other', messages: history(500) }
  await act(async () =>
    useWorkspace.setState({ sessions: [original, other], activeSessionId: other.id }),
  )
  expect(container.querySelectorAll('[data-message]')).toHaveLength(80)
  expect(container.querySelector('[data-message]')?.getAttribute('data-message')).toBe(
    'message-420',
  )
})
