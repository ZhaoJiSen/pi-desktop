// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickOpen } from '../../../src/components/source/QuickOpen'
import { SourceProvider, useSource } from '../../../src/components/source/context'
import { createPreviewSessions, previewProjects } from '../../../src/lib/fixtures'
import { useWorkspace } from '../../../src/store/workspace'

let root: Root
let container: HTMLDivElement

function Harness() {
  return (
    <SourceProvider>
      <Opener />
    </SourceProvider>
  )
}

function Opener() {
  const source = useSource()
  return (
    <>
      <button type="button" onClick={() => source?.setQuickOpen(true)}>
        open-quick
      </button>
      <QuickOpen />
    </>
  )
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
  useWorkspace.setState({
    language: 'en',
    projects: structuredClone(previewProjects),
    sessions: createPreviewSessions(),
    activeSessionId: 'model-selector',
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(createElement(Harness)))
  await act(async () => {
    document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('quick open', () => {
  it('exposes a listbox and moves the highlight on hover and arrow keys', async () => {
    const list = document.querySelector('[role="listbox"]')
    const options = [...document.querySelectorAll('[role="option"]')]
    expect(list).toBeTruthy()
    expect(options.length).toBeGreaterThan(1)
    const input = document.querySelector('.search-dialog input') as HTMLInputElement
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id)

    await act(async () => {
      options[1]?.dispatchEvent(
        new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
      )
    })
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]?.id)
    expect(options[1]?.getAttribute('aria-selected')).toBe('true')

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    const next = document.getElementById(input.getAttribute('aria-activedescendant') || '')
    expect(next?.id).toBe(options[2]?.id)
    expect(next?.getAttribute('aria-selected')).toBe('true')
  })
})
