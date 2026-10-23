// @vitest-environment happy-dom
import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileDiff } from '../../../src/components/source/FileDiff'
import { useWorkspace } from '../../../src/store/workspace'

let root: Root
let container: HTMLDivElement
let viewport = 600
let clipped = false
let fileInset = 0
let observers: (() => void)[] = []
const fixture = (count: number, offset = 0) =>
  `@@ -${offset + 1},${count} +${offset + 1},${count} @@\n` +
  Array.from({ length: count }, (_, index) => `-const item_${index} = false`).join('\n') +
  '\n' +
  Array.from({ length: count }, (_, index) => `+const item_${index} = true`).join('\n') +
  '\n'

async function render(text = fixture(500), layout: 'unified' | 'split' = 'unified', copies = 1) {
  await act(async () =>
    root.render(
      <StrictMode>
        {Array.from({ length: copies }, (_, index) => (
          <FileDiff
            key={index}
            path={`file-${index}.ts`}
            text={text}
            binary={false}
            missing={false}
            truncated={false}
            embedded
            layout={layout}
          />
        ))}
      </StrictMode>,
    ),
  )
}

async function scroll(top: number) {
  await act(async () => {
    container.scrollTop = top
    container.dispatchEvent(new Event('scroll'))
    await new Promise(requestAnimationFrame)
  })
}

beforeEach(() => {
  viewport = 600
  clipped = false
  fileInset = 0
  observers = []
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        observers.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this === container ? (clipped ? 0 : viewport) : Number.parseFloat(this.style.height) || 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this === container
      ? [...container.querySelectorAll<HTMLElement>('.source-virtual-diff')].reduce(
          (sum, node) => sum + Number.parseFloat(node.style.height),
          0,
        )
      : this.clientHeight
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.classList.contains('source-git-diff') && this.querySelector('.source-virtual-diff')) {
      return this.querySelector('.source-virtual-diff')!.getBoundingClientRect()
    }
    let top = 0
    let height = this === container ? viewport : Number.parseFloat(this.style.height) || 0
    if (this.classList.contains('source-virtual-diff')) {
      const viewers = [...container.querySelectorAll<HTMLElement>('.source-virtual-diff')]
      top =
        viewers
          .slice(0, viewers.indexOf(this))
          .reduce((sum, node) => sum + Number.parseFloat(node.style.height), 0) -
        container.scrollTop +
        fileInset
    }
    return {
      top,
      bottom: top + height,
      height,
      left: 0,
      right: 520,
      width: 520,
      x: 0,
      y: top,
      toJSON() {},
    }
  })
  useWorkspace.setState({ theme: 'light', language: 'en' })
  container = document.createElement('div')
  container.className = 'source-scroll'
  container.style.overflowY = 'auto'
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('virtual diff', () => {
  it('bounds mounted rows and renders the exact final line after a large scroll', async () => {
    await render()
    const viewer = container.querySelector<HTMLElement>('.source-virtual-diff')!
    expect(viewer.dataset.totalRows).toBe('1000')
    expect(container.querySelectorAll('[data-row]').length).toBeLessThan(70)
    expect(container.textContent).toContain('const item_0 = false')
    const id = viewer.id
    await scroll(Number.parseFloat(viewer.style.height) - viewport)
    expect(container.querySelector('[data-row="999"] [data-code]')?.textContent).toBe(
      'const item_499 = true',
    )
    expect(container.querySelector('[data-row="0"]')).toBeNull()
    expect(container.querySelectorAll('[data-row]').length).toBeLessThan(70)
    expect(viewer.id).toBe(id)
  })

  it('keeps split columns aligned for unequal changes and preserves original line numbers', async () => {
    const patch =
      '@@ -80,1 +80,300 @@\n-old\n' +
      Array.from({ length: 300 }, (_, i) => `+new_${i}`).join('\n') +
      '\n'
    await render(patch, 'split')
    const viewer = container.querySelector<HTMLElement>('.source-virtual-diff')!
    expect(viewer.dataset.totalRows).toBe('300')
    expect(
      container.querySelector('[data-side="old"] [data-row="0"] .source-diff-vnum')?.textContent,
    ).toBe('80')
    expect(
      container.querySelector('[data-side="new"] [data-row="0"] .source-diff-vnum')?.textContent,
    ).toBe('80')
    expect(
      container.querySelector('[data-side="old"] [data-row="1"]')?.getAttribute('data-state'),
    ).toBe('empty')
    await scroll(Number.parseFloat(viewer.style.height) - viewport)
    expect(
      container.querySelector('[data-side="new"] [data-row="299"] .source-diff-vnum')?.textContent,
    ).toBe('379')
    const leftRows = [...container.querySelectorAll('[data-side="old"] [data-row]')].map((row) =>
      row.getAttribute('data-row'),
    )
    const rightRows = [...container.querySelectorAll('[data-side="new"] [data-row]')].map((row) =>
      row.getAttribute('data-row'),
    )
    expect(leftRows).toEqual(rightRows)
  })

  it('releases collapsed and offscreen rows, then restores them without rebuilding the parser', async () => {
    await render(undefined, 'unified', 2)
    const viewers = [...container.querySelectorAll<HTMLElement>('.source-virtual-diff')]
    expect(viewers[0].querySelector('[data-row]')).not.toBeNull()
    expect(viewers[1].querySelector('[data-row]')).toBeNull()
    const id = viewers[0].id
    clipped = true
    await act(async () => {
      observers.forEach((callback) => callback())
      await new Promise(requestAnimationFrame)
    })
    expect(container.querySelector('[data-row]')).toBeNull()
    clipped = false
    await act(async () => {
      observers.forEach((callback) => callback())
      await new Promise(requestAnimationFrame)
    })
    expect(viewers[0].querySelector('[data-row]')).not.toBeNull()
    expect(viewers[0].id).toBe(id)
    await scroll(Number.parseFloat(viewers[0].style.height))
    expect(viewers[0].querySelector('[data-row]')).toBeNull()
    expect(viewers[1].querySelector('[data-row]')).not.toBeNull()
  })

  it('reuses parsed data for layout/theme changes but updates changed patches', async () => {
    await render()
    const viewer = container.querySelector<HTMLElement>('.source-virtual-diff')!
    const id = viewer.id
    await render(undefined, 'split')
    expect(viewer.id).toBe(id)
    expect(viewer.dataset.totalRows).toBe('500')
    await act(async () =>
      useWorkspace.setState({
        theme: 'dark',
        fonts: { ...useWorkspace.getState().fonts, codeSize: 16 },
      }),
    )
    expect(container.querySelector('[data-theme="dark"]')).not.toBeNull()
    expect(viewer.style.height).toBe(`${500 * 28}px`)
    await render(fixture(500).replace('item_0 = false', 'changed = false'))
    expect(container.querySelector('.source-virtual-diff')?.id).not.toBe(id)
    expect(container.textContent).toContain('const changed = false')
  })

  it('copies complete text across recycled rows without line numbers or operators', async () => {
    await render()
    const start = container.querySelector('[data-row="0"] [data-code]')!
    const selection = window.getSelection()!
    const range = document.createRange()
    await act(async () => {
      range.selectNodeContents(start)
      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
      await new Promise(requestAnimationFrame)
    })
    const viewer = container.querySelector<HTMLElement>('.source-virtual-diff')!
    await scroll((Number.parseFloat(viewer.style.height) / 1000) * 190)
    expect(container.contains(start)).toBe(true)
    const end = container.querySelector('[data-row="200"] [data-code]')!
    await act(async () => {
      range.setEnd(end, end.childNodes.length)
      selection.removeAllRanges()
      selection.addRange(range)
    })
    const setData = vi.fn()
    const event = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { setData } })
    // Native shortcuts can target body rather than the selected code element.
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    const copied = setData.mock.calls[0][1] as string
    expect(copied.split('\n')).toHaveLength(201)
    expect(copied.split('\n')[0]).toBe('const item_0 = false')
    expect(copied.split('\n').at(-1)).toBe('const item_200 = false')
    await act(async () => selection.removeAllRanges())
  })

  it('does not feed a clamped horizontal scroll back into the longer column', async () => {
    await render(undefined, 'split')
    const left = container.querySelector<HTMLElement>('[data-side="old"]')!
    const right = container.querySelector<HTMLElement>('[data-side="new"]')!
    const positions = new Map<HTMLElement, number>()
    for (const [element, maximum] of [
      [left, 483],
      [right, 2909],
    ] as const) {
      Object.defineProperties(element, {
        clientWidth: { configurable: true, value: 450 },
        scrollWidth: { configurable: true, value: maximum + 450 },
        scrollLeft: {
          configurable: true,
          get: () => positions.get(element) ?? 0,
          set: (value: number) => positions.set(element, Math.max(0, Math.min(maximum, value))),
        },
      })
    }
    await act(async () => {
      right.scrollLeft = 500
      right.dispatchEvent(new Event('scroll'))
      // Browsers emit another scroll event after the synchronized assignment.
      left.dispatchEvent(new Event('scroll'))
    })
    expect(left.scrollLeft).toBe(483)
    expect(right.scrollLeft).toBe(500)
    await act(async () => {
      left.scrollLeft = 200
      left.dispatchEvent(new Event('scroll'))
      right.dispatchEvent(new Event('scroll'))
    })
    expect(left.scrollLeft).toBe(200)
    expect(right.scrollLeft).toBe(200)
  })

  it('copies partial code through the document listener with multiple files mounted', async () => {
    await render(undefined, 'unified', 2)
    const code = container.querySelector('[data-row="0"] [data-code]')!
    const range = document.createRange()
    range.selectNodeContents(code)
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
    const text = walker.nextNode()!
    range.setStart(text, 2)
    range.setEnd(text, Math.min(5, text.textContent!.length))
    const selection = window.getSelection()!
    await act(async () => {
      selection.removeAllRanges()
      selection.addRange(range)
    })
    const setData = vi.fn()
    const event = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { setData } })
    document.body.dispatchEvent(event)
    expect(setData).toHaveBeenCalledExactlyOnceWith('text/plain', range.toString())
    expect(event.defaultPrevented).toBe(true)
  })

  it('copies a whole row selected by its element boundaries', async () => {
    await render()
    const row = container.querySelector('[data-row="0"]')!
    const range = document.createRange()
    range.selectNodeContents(row)
    await act(async () => {
      window.getSelection()!.removeAllRanges()
      window.getSelection()!.addRange(range)
    })
    const setData = vi.fn()
    const event = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { setData } })
    document.body.dispatchEvent(event)
    expect(setData).toHaveBeenCalledWith('text/plain', 'const item_0 = false')
  })

  it('uses the current layout data when copying after a layout switch', async () => {
    await render()
    await render(undefined, 'split')
    const code = container.querySelector('[data-side="new"] [data-row="0"] [data-code]')!
    const range = document.createRange()
    range.selectNodeContents(code)
    await act(async () => {
      window.getSelection()!.removeAllRanges()
      window.getSelection()!.addRange(range)
    })
    const setData = vi.fn()
    const event = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { setData } })
    document.body.dispatchEvent(event)
    expect(setData).toHaveBeenCalledExactlyOnceWith('text/plain', 'const item_0 = true')
  })

  it('leaves editable controls, outside selections and already handled copies alone', async () => {
    await render()
    const code = container.querySelector('[data-row="0"] [data-code]')!
    const range = document.createRange()
    range.selectNodeContents(code)
    const selection = window.getSelection()!
    await act(async () => {
      selection.removeAllRanges()
      selection.addRange(range)
    })
    const input = document.createElement('input')
    const outside = document.createElement('p')
    outside.textContent = 'outside'
    document.body.append(input, outside)
    try {
      const setData = vi.fn()
      const copy = (target: EventTarget, handled = false) => {
        const event = new Event('copy', { bubbles: true, cancelable: true })
        Object.defineProperty(event, 'clipboardData', { value: { setData } })
        if (handled) event.preventDefault()
        target.dispatchEvent(event)
        return event
      }
      expect(copy(input).defaultPrevented).toBe(false)
      copy(document.body, true)
      await act(async () => {
        range.selectNodeContents(outside)
        selection.removeAllRanges()
        selection.addRange(range)
      })
      expect(copy(document.body).defaultPrevented).toBe(false)
      expect(setData).not.toHaveBeenCalled()
    } finally {
      input.remove()
      outside.remove()
    }
  })

  it('removes document copy listeners when the diff unmounts', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    await render()
    await act(async () => root.render(null))
    const added = add.mock.calls.filter(([type]) => type === 'copy').map(([, listener]) => listener)
    const removed = remove.mock.calls
      .filter(([type]) => type === 'copy')
      .map(([, listener]) => listener)
    expect(added.length).toBeGreaterThan(0)
    expect(removed).toEqual(added)
  })

  it('keeps the current source line and partial-row offset across layout switches', async () => {
    await render()
    const viewer = container.querySelector<HTMLElement>('.source-virtual-diff')!
    const height = Number.parseFloat(viewer.style.height) / 1000
    await scroll(700 * height + 4)
    await render(undefined, 'split')
    expect(container.scrollTop).toBeCloseTo(200 * height + 4)
    expect(
      container.querySelector('[data-side="new"] [data-row="200"] [data-code]')?.textContent,
    ).toBe('const item_200 = true')
    await render()
    expect(container.scrollTop).toBeCloseTo(700 * height + 4)
  })

  it.each([0, 36])(
    'keeps the file beginning on layout changes with a %spx heading',
    async (inset) => {
      fileInset = inset
      await render()
      const code = container.querySelector<HTMLElement>('.source-git-diff')!
      code.style.overflowY = 'auto'
      code.style.height = container.querySelector<HTMLElement>('.source-virtual-diff')!.style.height
      await act(async () => {
        observers.forEach((callback) => callback())
        await new Promise(requestAnimationFrame)
      })
      await render(undefined, 'split')
      await render()
      expect(container.scrollTop).toBe(0)
      expect(container.querySelector('[data-row="0"] [data-code]')?.textContent).toBe(
        'const item_0 = false',
      )
    },
  )
})
