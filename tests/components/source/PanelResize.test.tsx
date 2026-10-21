// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PanelResize } from '../../../src/components/source/PanelResize'

let root: Root
let container: HTMLDivElement
let handle: HTMLElement
const onWidth = vi.fn()
const onDrag = vi.fn()

async function pointer(type: string, init: PointerEventInit = {}, target: EventTarget = window) {
  const event = new PointerEvent(type, {
    pointerId: 1,
    button: 0,
    clientX: 700,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  await act(async () => {
    target.dispatchEvent(event)
  })
  return event
}

function resizing() {
  return document.documentElement.classList.contains('source-panel-resizing')
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  onWidth.mockClear()
  onDrag.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(createElement(PanelResize, { width: 420, maxWidth: 1200, onWidth, onDrag }))
  })
  handle = container.querySelector('[role="separator"]')!
  let captured = false
  handle.setPointerCapture = vi.fn(() => {
    captured = true
  })
  handle.hasPointerCapture = vi.fn(() => captured)
  handle.releasePointerCapture = vi.fn(() => {
    captured = false
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  window.getSelection()?.removeAllRanges()
  vi.unstubAllGlobals()
})

describe('source panel resizing', () => {
  it('prevents native selection, clears an existing selection, and captures the pointer', async () => {
    const content = document.createElement('p')
    content.textContent = 'Conversation and source content'
    container.append(content)
    const range = document.createRange()
    range.selectNodeContents(content)
    window.getSelection()!.addRange(range)

    const event = await pointer('pointerdown', {}, handle)
    expect(event.defaultPrevented).toBe(true)
    expect(window.getSelection()!.rangeCount).toBe(0)
    expect(resizing()).toBe(true)
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1)
    expect(onDrag).toHaveBeenCalledWith(true)

    const move = await pointer('pointermove', { clientX: 600 })
    expect(move.defaultPrevented).toBe(true)
    expect(onWidth).toHaveBeenLastCalledWith(520, false)
    await pointer('pointerup')
    expect(resizing()).toBe(false)
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(onDrag).toHaveBeenLastCalledWith(false)
  })

  it.each(['pointerup', 'pointercancel', 'lostpointercapture', 'blur', 'unmount'])(
    'restores selection and stops resizing on %s',
    async (reason) => {
      await pointer('pointerdown', {}, handle)
      if (reason === 'unmount') {
        await act(async () => root.render(null))
      } else if (reason === 'blur') {
        await act(async () => window.dispatchEvent(new Event('blur')))
      } else {
        await pointer(reason, {}, reason === 'lostpointercapture' ? handle : window)
      }
      expect(resizing()).toBe(false)
      expect(onDrag.mock.calls).toEqual([[true], [false]])
      await pointer('pointermove', { clientX: 500 })
      await pointer('pointerup')
      expect(onWidth).not.toHaveBeenCalled()
      expect(onDrag).toHaveBeenCalledTimes(2)
    },
  )

  it('ignores secondary buttons and unrelated pointers, and preserves width bounds', async () => {
    await pointer('pointerdown', { button: 2 }, handle)
    expect(resizing()).toBe(false)
    expect(onDrag).not.toHaveBeenCalled()

    await pointer('pointerdown', {}, handle)
    await pointer('pointermove', { pointerId: 2, clientX: 600 })
    await pointer('pointerup', { pointerId: 2 })
    expect(onWidth).not.toHaveBeenCalled()
    expect(resizing()).toBe(true)
    await pointer('pointermove', { clientX: 2000 })
    expect(onWidth).toHaveBeenLastCalledWith(320, true)
    await pointer('pointermove', { clientX: 0 })
    expect(onWidth).toHaveBeenLastCalledWith(1120, false)
    await pointer('pointermove', { clientX: -1000 })
    expect(onWidth).toHaveBeenLastCalledWith(1200, false)
  })

  it('can start another drag after cancellation without leaving stale listeners', async () => {
    await pointer('pointerdown', {}, handle)
    await pointer('pointercancel')
    await pointer('pointerdown', { pointerId: 2, clientX: 600 }, handle)
    await pointer('pointermove', { pointerId: 1, clientX: 500 })
    expect(onWidth).not.toHaveBeenCalled()
    await pointer('pointermove', { pointerId: 2, clientX: 550 })
    expect(onWidth.mock.calls).toEqual([[470, false]])
    await pointer('pointerup', { pointerId: 2 })
    expect(resizing()).toBe(false)
    expect(onDrag.mock.calls).toEqual([[true], [false], [true], [false]])
  })
})
