// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileViewer } from '../../../src/components/source/FileViewer'
import { useWorkspace } from '../../../src/store/workspace'

let root: Root
let container: HTMLDivElement

function key(init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  window.dispatchEvent(event)
  return event
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  useWorkspace.setState({ language: 'en' })
  container = document.createElement('div')
  container.className = 'source-panel'
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      createElement(FileViewer, {
        projectPath: '~/Projects/pi-desktop',
        path: 'readme.md',
        tick: 0,
        changed: false,
        onBack: () => {},
        onDiff: () => {},
        onHistory: () => {},
      }),
    ),
  )
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('file viewer find and copy', () => {
  it('counts matches, closes on Escape, and copies with feedback', async () => {
    const input = document.querySelector('.source-find') as HTMLInputElement
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      set.call(input, 'pi')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(document.querySelector('.source-find-status')?.textContent).toBe('1 of 1')
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(document.querySelector('.source-file'))

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    await act(async () => {
      ;[...document.querySelectorAll('button')]
        .find((item) => item.textContent === 'Copy')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# pi-desktop'))
    expect(document.body.textContent).toContain('Copied')
  })

  it('handles find only while focus is inside the panel', async () => {
    const outside = document.createElement('input')
    document.body.append(outside)
    outside.focus()
    const ignored = key({ key: 'f', ctrlKey: true })
    expect(ignored.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(outside)

    document.querySelector('.source-file')?.dispatchEvent(new FocusEvent('focus'))
    ;(document.querySelector('.source-file') as HTMLElement).focus()
    const handled = key({ key: 'f', ctrlKey: true })
    expect(handled.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(document.querySelector('.source-find'))

    const shifted = key({ key: 'f', ctrlKey: true, shiftKey: true })
    const repeated = key({ key: 'f', ctrlKey: true, repeat: true })
    const alt = key({ key: 'f', ctrlKey: true, altKey: true })
    expect(shifted.defaultPrevented).toBe(false)
    expect(repeated.defaultPrevented).toBe(false)
    expect(alt.defaultPrevented).toBe(false)
    outside.remove()
  })
})
