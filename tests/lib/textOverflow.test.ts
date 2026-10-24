// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isTextTruncated, observeTextTruncation } from '../../src/lib/textOverflow'

function label(width = 80, scroll = 120) {
  const element = document.createElement('span')
  element.style.cssText = 'display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: width },
    scrollWidth: { configurable: true, value: scroll },
  })
  document.body.append(element)
  return element
}
afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})
describe('rendered text truncation', () => {
  it('only detects clipping with ellipsis, not literal dots or ordinary scrolling', () => {
    const element = label()
    expect(isTextTruncated(element)).toBe(true)
    element.style.overflow = 'visible'
    expect(isTextTruncated(element)).toBe(false)
    element.style.overflow = 'hidden'
    element.style.textOverflow = 'clip'
    expect(isTextTruncated(element)).toBe(false)
    const fits = label(120, 120)
    fits.textContent = 'Literal ...'
    expect(isTextTruncated(fits)).toBe(false)
  })
  it('finds a clipped descendant in composite paths and ignores hidden content', () => {
    const parent = label(160, 160)
    const child = label(60, 100)
    parent.append(child)
    expect(isTextTruncated(parent)).toBe(false)
    expect(isTextTruncated(parent, true)).toBe(true)
    parent.style.display = 'contents'
    expect(isTextTruncated(parent, true)).toBe(true)
    parent.style.display = 'none'
    expect(isTextTruncated(parent, true)).toBe(false)
  })
  it('updates after resizing and disconnects cleanly', () => {
    let resize!: () => void
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe() {}
        disconnect = disconnect
      },
    )
    const element = label()
    const changed = vi.fn()
    const stop = observeTextTruncation(element, changed)
    expect(changed).toHaveBeenLastCalledWith(true)
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 140 })
    resize()
    expect(changed).toHaveBeenLastCalledWith(false)
    stop()
    expect(disconnect).toHaveBeenCalledOnce()
    changed.mockClear()
    resize()
    expect(changed).not.toHaveBeenCalled()
  })
})
