// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { OverflowTooltip } from '../../src/components/OverflowTooltip'

let root: Root, container: HTMLDivElement
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it.each([false, true])(
  'only opens for real ellipsis, including warm Tooltip state (clipped: %s)',
  async (clipped) => {
    await act(async () =>
      root.render(
        <OverflowTooltip
          text="Complete branch name"
          style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
        />,
      ),
    )
    const element = container.querySelector<HTMLElement>('.overflow-tooltip-text')!
    Object.defineProperties(element, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: clipped ? 180 : 100 },
    })
    await act(async () => {
      document.body.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }),
      )
      element.dispatchEvent(
        new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
      )
      element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    await act(async () => vi.advanceTimersByTime(500))
    expect(Boolean(document.querySelector('[role="tooltip"]'))).toBe(clipped)
    if (clipped) {
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Complete branch name')
      Object.defineProperty(element, 'scrollWidth', { configurable: true, value: 40 })
      await act(async () =>
        root.render(
          <OverflowTooltip text="Short" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} />,
        ),
      )
      await act(async () => vi.advanceTimersByTime(250))
      expect(document.querySelector('[role="tooltip"]')).toBeNull()
    }
  },
)
