// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiffLayout } from '../../../src/components/source/useDiffLayout'

let root: Root
let container: HTMLDivElement
let width: number
let notify: ResizeObserverCallback
const disconnect = vi.fn()
const observe = vi.fn()

function Probe({ visible = true, enabled = true }: { visible?: boolean; enabled?: boolean }) {
  const { ref, layout, setLayout } = useDiffLayout(enabled)
  return (
    <>
      <button onClick={() => setLayout(layout === 'split' ? 'unified' : 'split')}>Toggle</button>
      {visible && <div ref={ref} data-layout={layout} />}
    </>
  )
}

function mode() {
  return container.querySelector('[data-layout]')?.getAttribute('data-layout')
}

async function mount(props: { visible?: boolean; enabled?: boolean } = {}) {
  await act(async () => root.render(<Probe {...props} />))
}

async function resize(next: number) {
  width = next
  await act(async () => {
    notify([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver)
  })
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  width = 420
  disconnect.mockClear()
  observe.mockClear()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width }) as DOMRect,
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback
      }
      observe = observe
      disconnect = disconnect
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

describe('responsive diff layout', () => {
  it('starts unified in a narrow pane and switches both ways when the pane resizes', async () => {
    await mount()
    expect(mode()).toBe('unified')
    await resize(900)
    expect(mode()).toBe('split')
    await resize(450)
    expect(mode()).toBe('unified')
  })

  it('uses the actual initial width, including after content finishes loading', async () => {
    width = 900
    await mount({ visible: false })
    expect(observe).not.toHaveBeenCalled()
    await mount()
    expect(mode()).toBe('split')
    expect(observe).toHaveBeenCalledTimes(1)
  })

  it('does not flicker around the split breakpoint or reset when temporarily hidden', async () => {
    await mount()
    await resize(720)
    expect(mode()).toBe('split')
    for (const size of [719, 700, 680, 0, 710]) {
      await resize(size)
      expect(mode()).toBe('split')
    }
    await resize(679)
    expect(mode()).toBe('unified')
    for (const size of [690, 710, 719]) {
      await resize(size)
      expect(mode()).toBe('unified')
    }
  })

  it('preserves a manual choice through tiny changes and returns to auto after a deliberate resize', async () => {
    width = 800
    await mount()
    await act(async () => container.querySelector('button')!.click())
    expect(mode()).toBe('unified')
    await resize(810)
    expect(mode()).toBe('unified')
    await resize(850)
    expect(mode()).toBe('split')
    await resize(600)
    expect(mode()).toBe('unified')
    await resize(800)
    expect(mode()).toBe('split')
    await resize(400)
    await act(async () => container.querySelector('button')!.click())
    expect(mode()).toBe('split')
    await resize(410)
    expect(mode()).toBe('split')
    await resize(450)
    expect(mode()).toBe('unified')
  })

  it('does not observe each embedded file when the parent controls its layout', async () => {
    await mount({ enabled: false })
    expect(observe).not.toHaveBeenCalled()
  })

  it('disconnects when the measured content unmounts', async () => {
    await mount()
    await mount({ visible: false })
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
