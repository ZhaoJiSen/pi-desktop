// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePaneTransition } from '../../src/hooks/usePaneTransition'
import { RetainedView } from '../../src/components/RetainedView'

let root: Root, container: HTMLDivElement
let media: EventTarget & { matches: boolean }
let frames: Map<number, FrameRequestCallback>, nextFrame: number
const animations: {
  cancel: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  onfinish: (() => void) | null
}[] = []
const animate = vi.fn(() => {
  const animation = {
    cancel: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
    currentTime: null as number | null,
    onfinish: null as (() => void) | null,
    finished: Promise.resolve(),
  }
  animations.push(animation)
  return animation as unknown as Animation
})
function Panel({ page, reveal }: { page: string; reveal: boolean }) {
  const ref = usePaneTransition(page, { reveal })
  return h('div', { ref }, h('input', { defaultValue: 'draft' }))
}
async function show(page: string, { reveal = false, active = true, flush = true } = {}) {
  await act(async () =>
    root.render(h(RetainedView, { active, children: h(Panel, { page, reveal }) })),
  )
  if (flush)
    await act(async () => {
      const pending = [...frames.values()]
      frames.clear()
      for (const callback of pending) callback(performance.now())
    })
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  media = Object.assign(new EventTarget(), { matches: false })
  frames = new Map()
  nextFrame = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('matchMedia', () => media)
  vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(animate)
  animate.mockClear()
  animations.length = 0
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
it('animates only navigation and preserves content identity and input', async () => {
  await show('chat')
  const input = container.querySelector('input')!
  input.value = 'unsaved'
  expect(animate).not.toHaveBeenCalled()
  await show('settings')
  expect(animate).toHaveBeenCalledTimes(1)
  expect(container.querySelector('input')).toBe(input)
  expect(input.value).toBe('unsaved')
  expect(container.firstElementChild?.getAttribute('style')).toBeNull()
  await show('settings')
  expect(animate).toHaveBeenCalledTimes(1)
})
it('cancels interrupted animations and cleans up on unmount', async () => {
  await show('chat')
  await show('settings')
  await show('chat')
  expect(animations[0]!.cancel).toHaveBeenCalled()
  expect(animations[0]!.onfinish).toBeNull()
  const remove = vi.spyOn(media, 'removeEventListener')
  await act(async () => root.unmount())
  expect(animations[1]!.cancel).toHaveBeenCalled()
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
  root = createRoot(container)
})
it('honors reduced motion and cancels when the preference changes mid-transition', async () => {
  await show('chat')
  media.matches = true
  await show('settings')
  expect(animate).not.toHaveBeenCalled()
  media.matches = false
  await show('chat')
  media.matches = true
  media.dispatchEvent(new Event('change'))
  expect(animations[0]!.cancel).toHaveBeenCalled()
})
it('releases the finished animation and its preference listener', async () => {
  await show('chat')
  await show('settings')
  const remove = vi.spyOn(media, 'removeEventListener')
  animations[0]!.onfinish!()
  expect(animations[0]!.cancel).toHaveBeenCalled()
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
})
it('reveals newly mounted and resumed pages after layout without remounting content', async () => {
  await show('chat', { reveal: true, flush: false })
  expect(animate).toHaveBeenCalledTimes(1)
  expect(animations[0]!.play).not.toHaveBeenCalled()
  await show('chat', { reveal: true })
  const input = container.querySelector('input')!
  expect(animate).toHaveBeenCalledTimes(1)
  await show('chat', { reveal: true, active: false })
  expect(animations[0]!.cancel).toHaveBeenCalled()
  await show('chat', { reveal: true })
  expect(animate).toHaveBeenCalledTimes(2)
  expect(container.querySelector('input')).toBe(input)
})
it('cancels a scheduled reveal before it can run after the page is hidden', async () => {
  await show('chat', { reveal: true, flush: false })
  await show('chat', { reveal: true, active: false })
  expect(animations[0]!.play).not.toHaveBeenCalled()
  expect(animations[0]!.cancel).toHaveBeenCalled()
  expect(frames.size).toBe(0)
})
