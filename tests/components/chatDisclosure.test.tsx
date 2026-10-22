// @vitest-environment happy-dom
import { StrictMode, act, createElement as h, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const motionPreference = vi.hoisted(() => ({ reduced: false }))

vi.mock('motion/react', () => ({
  motion: {
    create: (component: unknown) => component,
    article: ({ children, className }: { children: ReactNode; className?: string }) =>
      h('article', { className }, children),
    div: ({ children, className }: { children: ReactNode; className?: string }) =>
      h('div', { className }, children),
  },
  useReducedMotion: () => motionPreference.reduced,
}))
vi.mock('@heroui/react', async (original) => ({
  ...(await original<typeof import('@heroui/react')>()),
  ScrollShadow: ({
    children,
    ref,
    className,
    onScroll,
  }: {
    children: ReactNode
    ref?: React.Ref<HTMLDivElement>
    className?: string
    onScroll?: () => void
  }) => h('div', { ref, className, onScroll }, children),
}))
import { ChatDisclosure } from '../../src/components/conversation/ChatDisclosure'
import { Conversation } from '../../src/components/Conversation'
import { useWorkspace } from '../../src/store/workspace'
import { makeSession } from '../../src/lib/fixtures'
import type { Message, ToolBlock } from '../../src/types'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  motionPreference.reduced = false
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  useWorkspace.setState({ language: 'en', runningSessionId: null })
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  useWorkspace.flushPersistence()
  vi.unstubAllGlobals()
})

async function transition(panel: Element, type = 'transitionend') {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, 'propertyName', { value: 'grid-template-rows' })
  await act(async () => panel.dispatchEvent(event))
}

it('toggles a large body without synchronous size reads or remounting its contents', async () => {
  const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
  const width = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
  const mount = vi.fn()
  const unmount = vi.fn()
  function Body() {
    useEffect(() => {
      mount()
      return unmount
    }, [])
    return <pre>{'const value = 1;\n'.repeat(5000)}</pre>
  }
  await act(async () =>
    root.render(
      <ChatDisclosure
        className="tool-block"
        triggerClassName="tool"
        label="Large output"
        defaultExpanded
      >
        <Body />
      </ChatDisclosure>,
    ),
  )
  const button = container.querySelector('button')!
  const panel = document.getElementById(button.getAttribute('aria-controls')!)!
  const code = panel.querySelector('pre')
  expect(panel.getAttribute('aria-labelledby')).toBe(button.id)
  expect(panel.hasAttribute('hidden')).toBe(false)
  await act(async () => button.click())
  expect(button.getAttribute('aria-expanded')).toBe('false')
  expect(panel.hasAttribute('hidden')).toBe(false)
  expect(panel.hasAttribute('inert')).toBe(true)
  await transition(panel)
  expect(panel.getAttribute('hidden')).toBe('until-found')
  expect(panel.hasAttribute('inert')).toBe(false)
  expect(panel.getAttribute('aria-hidden')).toBe('true')
  await act(async () => button.click())
  expect(panel.hasAttribute('hidden')).toBe(false)
  expect(panel.querySelector('pre')).toBe(code)
  expect(mount).toHaveBeenCalledOnce()
  expect(unmount).not.toHaveBeenCalled()
  expect(height).not.toHaveBeenCalled()
  expect(width).not.toHaveBeenCalled()
})

it('reverses an interrupted transition without hiding an opening panel', async () => {
  await act(async () =>
    root.render(
      <ChatDisclosure className="tool-block" triggerClassName="tool" label="Reversible">
        <p>Output</p>
      </ChatDisclosure>,
    ),
  )
  const button = container.querySelector('button')!
  const panel = container.querySelector<HTMLElement>('.chat-disclosure-content')!
  Object.defineProperty(panel, 'getAnimations', { value: () => [{ playState: 'running' }] })
  await act(async () => button.click())
  await act(async () => button.click())
  await transition(panel, 'transitioncancel')
  await act(async () => {
    await new Promise(requestAnimationFrame)
  })
  expect(panel.hasAttribute('hidden')).toBe(false)
  await act(async () => button.click())
  await transition(panel)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  expect(panel.hasAttribute('hidden')).toBe(false)
  await act(async () => button.click())
  await transition(panel)
  expect(panel.getAttribute('hidden')).toBe('until-found')
})

it('does not finish a group collapse when only a nested panel transition ends', async () => {
  await act(async () =>
    root.render(
      <ChatDisclosure className="tool-group" triggerClassName="tool" label="Group" defaultExpanded>
        <ChatDisclosure
          className="tool-block"
          triggerClassName="tool"
          label="Nested"
          defaultExpanded
        >
          <p>Content</p>
        </ChatDisclosure>
      </ChatDisclosure>,
    ),
  )
  const panels = container.querySelectorAll('.chat-disclosure-content')
  await act(async () => container.querySelector('button')!.click())
  await transition(panels[1])
  expect(panels[0].hasAttribute('hidden')).toBe(false)
  await transition(panels[0])
  expect(panels[0].getAttribute('hidden')).toBe('until-found')
})

it('switches immediately when reduced motion is requested', async () => {
  motionPreference.reduced = true
  await act(async () =>
    root.render(
      <ChatDisclosure
        className="tool-block"
        triggerClassName="tool"
        label="Reduced"
        defaultExpanded
      >
        <p>Content</p>
      </ChatDisclosure>,
    ),
  )
  const panel = container.querySelector('.chat-disclosure-content')!
  await act(async () => container.querySelector('button')!.click())
  expect(panel.getAttribute('hidden')).toBe('until-found')
  expect(panel.getAttribute('data-instant')).toBe('true')
})

it('keeps header actions separate from the disclosure trigger', async () => {
  const action = vi.fn()
  await act(async () =>
    root.render(
      <ChatDisclosure
        className="tool-block"
        triggerClassName="tool"
        label="Tool"
        action={<button onClick={action}>Open diff</button>}
      >
        <p>Output</p>
      </ChatDisclosure>,
    ),
  )
  const [trigger, source] = container.querySelectorAll('button')
  expect(trigger.contains(source)).toBe(false)
  await act(async () => source.click())
  expect(action).toHaveBeenCalledOnce()
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

it('reveals matched text and its containing group for browser find', async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <ChatDisclosure className="tool-group" triggerClassName="tool" label="Group">
          <ChatDisclosure className="tool-block" triggerClassName="tool" label="Nested">
            <p>Find this text</p>
          </ChatDisclosure>
        </ChatDisclosure>
      </StrictMode>,
    ),
  )
  const panels = container.querySelectorAll('.chat-disclosure-content')
  await act(async () => panels[1].dispatchEvent(new Event('beforematch', { bubbles: true })))
  expect(
    [...container.querySelectorAll('button')].map((button) => button.getAttribute('aria-expanded')),
  ).toEqual(['true', 'true'])
  expect([...panels].every((panel) => !panel.hasAttribute('hidden'))).toBe(true)
  expect([...panels].every((panel) => panel.getAttribute('data-instant') === 'true')).toBe(true)
})

it('uses the parent state for controlled disclosures, including browser matches', async () => {
  const change = vi.fn()
  const render = (expanded: boolean) =>
    act(async () =>
      root.render(
        <ChatDisclosure
          className="tool-block"
          triggerClassName="tool"
          label="Controlled"
          expanded={expanded}
          onExpandedChange={change}
        >
          <p>Content</p>
        </ChatDisclosure>,
      ),
    )
  await render(false)
  await transition(container.querySelector('.chat-disclosure-content')!)
  const button = container.querySelector('button')!
  await act(async () => button.click())
  expect(change).toHaveBeenLastCalledWith(true)
  expect(button.getAttribute('aria-expanded')).toBe('false')
  await render(true)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  await render(false)
  await act(async () =>
    container.querySelector('.chat-disclosure-content')!.dispatchEvent(new Event('beforematch')),
  )
  expect(change).toHaveBeenLastCalledWith(true)
})

it('does not reread other messages when one tool collapses and preserves the choice on streaming updates', async () => {
  const tool = (id: string): ToolBlock => ({
    type: 'tool',
    id,
    name: 'edit',
    label: id + '.ts',
    status: 'done',
    output: '',
    args: { path: id + '.ts' },
    diff: [{ kind: 'add', number: 1, text: 'const value = 1;' }],
  })
  const firstTool = tool('first')
  const lastTool = tool('last')
  const readOther = vi.fn(() => [firstTool])
  const first: Message = {
    id: 'first',
    role: 'assistant',
    timestamp: 1,
    get blocks() {
      return readOther()
    },
  }
  const last: Message = { id: 'last', role: 'assistant', timestamp: 2, blocks: [lastTool] }
  const session = { ...makeSession('project'), id: 'active', messages: [first, last] }
  await act(async () => useWorkspace.setState({ sessions: [session], activeSessionId: session.id }))
  await act(async () => root.render(<Conversation onProject={() => {}} />))
  readOther.mockClear()
  const buttons = container.querySelectorAll<HTMLButtonElement>(
    '.tool-block > .chat-disclosure-heading > button',
  )
  expect([...buttons].map((button) => button.getAttribute('aria-expanded'))).toEqual([
    'false',
    'false',
  ])
  await act(async () => buttons[1].click())
  readOther.mockClear()
  await act(async () => buttons[1].click())
  expect(buttons[1].getAttribute('aria-expanded')).toBe('false')
  expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
  expect(readOther).not.toHaveBeenCalled()
  await act(async () =>
    useWorkspace.getState().updateSession('active', {
      messages: [first, { ...last, blocks: [{ ...lastTool, output: 'Updated' }] }],
    }),
  )
  expect(buttons[1].getAttribute('aria-expanded')).toBe('false')
})

it('preserves each tool choice when its containing group is collapsed and reopened', async () => {
  const tools: ToolBlock[] = ['one', 'two'].map((id) => ({
    type: 'tool',
    id,
    name: 'edit',
    label: `${id}.ts`,
    status: 'done',
    output: '',
    args: {},
    diff: [{ kind: 'add', number: 1, text: 'const value = 1;' }],
  }))
  const session = {
    ...makeSession('project'),
    id: 'active',
    messages: [
      {
        id: 'group',
        role: 'assistant' as const,
        timestamp: 1,
        blocks: tools,
      },
    ],
  }
  await act(async () => useWorkspace.setState({ sessions: [session], activeSessionId: session.id }))
  await act(async () => root.render(<Conversation onProject={() => {}} />))
  const group = container.querySelector<HTMLButtonElement>('.tool-group-trigger')!
  const children = container.querySelectorAll<HTMLButtonElement>(
    '.tool-block > .chat-disclosure-heading > button',
  )
  expect(group.getAttribute('aria-expanded')).toBe('false')
  await act(async () => group.click())
  await act(async () => children[0].click())
  await act(async () => group.click())
  expect(group.getAttribute('aria-expanded')).toBe('false')
  await act(async () => group.click())
  expect([...children].map((button) => button.getAttribute('aria-expanded'))).toEqual([
    'true',
    'false',
  ])
})

it('collapses a completed tool group by default while retaining an explicit expansion', async () => {
  const tools: ToolBlock[] = ['one', 'two'].map((id) => ({
    type: 'tool',
    id,
    name: 'edit',
    label: `${id}.ts`,
    status: 'running',
    output: '',
    args: {},
    diff: [{ kind: 'add', number: 1, text: 'const value = 1;' }],
  }))
  const session = {
    ...makeSession('project'),
    id: 'active',
    messages: [
      {
        id: 'group',
        role: 'assistant' as const,
        timestamp: 1,
        blocks: tools,
      },
    ],
  }
  await act(async () => useWorkspace.setState({ sessions: [session], activeSessionId: session.id }))
  await act(async () => root.render(<Conversation onProject={() => {}} />))
  const group = container.querySelector<HTMLButtonElement>('.tool-group-trigger')!
  const update = (status: ToolBlock['status']) =>
    act(async () =>
      useWorkspace.getState().updateSession('active', {
        messages: [{ ...session.messages[0], blocks: tools.map((tool) => ({ ...tool, status })) }],
      }),
    )
  expect(group.getAttribute('aria-expanded')).toBe('true')
  await update('done')
  expect(group.getAttribute('aria-expanded')).toBe('false')
  await update('running')
  await act(async () => group.click())
  await act(async () => group.click())
  await update('done')
  expect(group.getAttribute('aria-expanded')).toBe('true')
})
