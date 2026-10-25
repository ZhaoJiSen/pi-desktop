// @vitest-environment happy-dom
import { act, createElement as h, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RetainedView } from '../../src/components/RetainedView'

let root: Root, container: HTMLDivElement
const subscribe = vi.fn(),
  unsubscribe = vi.fn(),
  render = vi.fn()
function Panel() {
  const [draft, setDraft] = useState('')
  render()
  useEffect(() => {
    subscribe()
    return () => {
      unsubscribe()
    }
  }, [])
  return h('input', { value: draft, onChange: (e) => setDraft(e.target.value) })
}
async function show(active: boolean) {
  await act(async () => root.render(h(RetainedView, { active, children: h(Panel) })))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
it('does not initialize a page until its first visit', async () => {
  await show(false)
  expect(render).not.toHaveBeenCalled()
  expect(subscribe).not.toHaveBeenCalled()
  expect(container.querySelector('input')).toBeNull()
  await show(true)
  expect(subscribe).toHaveBeenCalledTimes(1)
})
it('keeps the same input and draft while pausing and resuming subscriptions', async () => {
  await show(true)
  const input = container.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      'unsaved',
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await show(false)
  expect(unsubscribe).toHaveBeenCalledTimes(1)
  await show(false)
  expect(subscribe).toHaveBeenCalledTimes(1)
  await show(true)
  expect(container.querySelector('input')).toBe(input)
  expect(input.value).toBe('unsaved')
  expect(subscribe).toHaveBeenCalledTimes(2)
  await show(false)
  expect(unsubscribe).toHaveBeenCalledTimes(2)
})
