// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PanelResize } from '../../../src/components/source/PanelResize'
import { ChatStage } from '../../../src/layouts/ChatStage'

const source = vi.hoisted(() => ({ open: true, setOpen: vi.fn() }))
vi.mock('../../../src/components/source/context', () => ({ useSource: () => source }))
vi.mock('../../../src/components/source/SourcePanel', () => ({
  SourcePanel: (props: {
    width: number
    maxWidth: number
    expanded: boolean
    onWidth: (next: number) => void
    onShowConversation: () => void
  }) => (
    <aside style={{ width: props.width }}>
      {props.expanded && <button onClick={props.onShowConversation}>Show conversation</button>}
      <PanelResize
        width={props.width}
        maxWidth={props.maxWidth}
        onWidth={props.onWidth}
        onDrag={() => {}}
        onReset={props.onShowConversation}
      />
    </aside>
  ),
}))

let root: Root
let container: HTMLDivElement
let available: number
let resize: () => void

async function mount(open = true) {
  source.open = open
  await act(async () => {
    root.render(
      <ChatStage empty={false}>
        <input defaultValue="Unsent draft" />
      </ChatStage>,
    )
  })
  const handle = container.querySelector<HTMLElement>('[role="separator"]')!
  handle.setPointerCapture = vi.fn()
  handle.hasPointerCapture = () => false
}

async function pointer(type: string, x: number) {
  const target =
    type === 'pointerdown' ? container.querySelector<HTMLElement>('[role="separator"]')! : window
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, { pointerId: 1, button: 0, clientX: x, bubbles: true }),
    )
  })
}

function width() {
  return container.querySelector('aside')!.style.width
}

function expanded() {
  return container.firstElementChild!.getAttribute('data-source-expanded') === 'true'
}

async function resizeStage(next: number) {
  available = next
  await act(async () => resize())
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  available = 1200
  source.setOpen.mockClear()
  localStorage.clear()
  localStorage.setItem('pi.source-panel-width', '420')
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width: available }) as DOMRect,
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = () => callback([], {} as ResizeObserver)
      }
      observe() {}
      disconnect() {}
    },
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('source workspace layout', () => {
  it('defaults to enough width for a persistent tree and content pane', async () => {
    localStorage.removeItem('pi.source-panel-width')
    await mount()
    expect(width()).toBe('760px')
    expect(expanded()).toBe(false)
  })

  it('can reverse an expansion during the same drag without getting stuck or oscillating', async () => {
    await mount()
    await pointer('pointerdown', 780)
    await pointer('pointermove', 220)
    expect(expanded()).toBe(true)
    await pointer('pointermove', 200)
    expect(expanded()).toBe(true)
    await pointer('pointermove', 212)
    expect(expanded()).toBe(false)
    expect(width()).toBe('880px')
    await pointer('pointerup', 212)
  })

  it('restores the conversation after a short drag from full width', async () => {
    localStorage.setItem('pi.source-panel-width', 'expanded')
    await mount()
    await pointer('pointerdown', 0)
    await pointer('pointermove', 12)
    await pointer('pointerup', 12)
    expect(expanded()).toBe(false)
    expect(width()).toBe('880px')
    expect(container.querySelector('input')!.parentElement!.hasAttribute('inert')).toBe(false)
    expect(localStorage.getItem('pi.source-panel-width')).toBe('880')
  })

  it('restores the previous split with the visible action, including after remount', async () => {
    localStorage.setItem('pi.source-panel-width', '800')
    await mount()
    await pointer('pointerdown', 400)
    await pointer('pointermove', 100)
    await pointer('pointerup', 100)
    expect(expanded()).toBe(true)
    await act(async () => container.querySelector('button')!.click())
    expect(width()).toBe('800px')
    expect(expanded()).toBe(false)

    await pointer('pointerdown', 400)
    await pointer('pointermove', 100)
    await pointer('pointerup', 100)
    await act(async () => root.unmount())
    root = createRoot(container)
    await mount()
    await act(async () => container.querySelector('button')!.click())
    expect(width()).toBe('800px')
    expect(expanded()).toBe(false)
  })

  it('allows keyboard and double-click recovery without a long drag', async () => {
    localStorage.setItem('pi.source-panel-width', 'expanded')
    await mount()
    const handle = container.querySelector('[role="separator"]')!
    await act(async () => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(expanded()).toBe(false)
    expect(width()).toBe('880px')
    await pointer('pointerdown', 320)
    await pointer('pointermove', 100)
    await pointer('pointerup', 100)
    expect(expanded()).toBe(true)
    await act(async () => {
      handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(expanded()).toBe(false)
    expect(width()).toBe('880px')
  })

  it('returns to the conversation in a window too narrow for two panes', async () => {
    available = 500
    await mount()
    expect(expanded()).toBe(true)
    await act(async () => container.querySelector('button')!.click())
    expect(source.setOpen).toHaveBeenCalledWith(false)
  })

  it('can grow beyond 640px, fills the workspace near the left edge, and restores the draft', async () => {
    await mount()
    const input = container.querySelector('input')!
    input.value = 'Draft and conversation stay mounted'
    await pointer('pointerdown', 780)
    await pointer('pointermove', 400)
    expect(width()).toBe('800px')
    expect(expanded()).toBe(false)
    await pointer('pointermove', 220)
    expect(width()).toBe('1200px')
    expect(expanded()).toBe(true)
    expect(input.parentElement!.hasAttribute('inert')).toBe(true)
    await pointer('pointerup', 220)

    await pointer('pointerdown', 0)
    await pointer('pointermove', 400)
    await pointer('pointerup', 400)
    expect(width()).toBe('800px')
    expect(expanded()).toBe(false)
    expect(input.parentElement!.hasAttribute('inert')).toBe(false)
    expect(container.querySelector('input')).toBe(input)
    expect(input.value).toBe('Draft and conversation stay mounted')
  })

  it('restores a wide preference after remount and keeps expanded mode across window resizing', async () => {
    localStorage.setItem('pi.source-panel-width', '800')
    await mount()
    expect(width()).toBe('800px')
    await pointer('pointerdown', 400)
    await pointer('pointermove', 100)
    await pointer('pointerup', 100)
    expect(localStorage.getItem('pi.source-panel-width')).toBe('expanded')
    await act(async () => root.unmount())
    root = createRoot(container)
    await mount()
    expect(expanded()).toBe(true)
    await resizeStage(1800)
    expect(width()).toBe('1800px')
    expect(expanded()).toBe(true)
    await mount(false)
    expect(expanded()).toBe(false)
    await mount()
    expect(expanded()).toBe(true)
  })

  it('fits narrow windows even when the drag goes beyond their edge', async () => {
    await mount()
    expect(width()).toBe('420px')
    await resizeStage(250)
    expect(width()).toBe('250px')
    expect(expanded()).toBe(true)
    await pointer('pointerdown', 0)
    await pointer('pointermove', -500)
    await pointer('pointerup', -500)
    expect(width()).toBe('250px')
  })

  it('preserves the split preference when only the window is made narrower', async () => {
    localStorage.setItem('pi.source-panel-width', '800')
    await mount()
    await resizeStage(900)
    expect(expanded()).toBe(true)
    expect(width()).toBe('900px')
    await resizeStage(1600)
    expect(expanded()).toBe(false)
    expect(width()).toBe('800px')
    expect(localStorage.getItem('pi.source-panel-width')).toBe('800')
  })

  it('continues resizing if reading or saving the preference fails', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    await mount()
    expect(width()).toBe('760px')
    await pointer('pointerdown', 440)
    await pointer('pointermove', 400)
    await pointer('pointerup', 400)
    expect(width()).toBe('800px')
  })
})
