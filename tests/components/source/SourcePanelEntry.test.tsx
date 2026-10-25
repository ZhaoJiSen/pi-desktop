// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Header } from '../../../src/components/Header'
import { SourceProvider } from '../../../src/components/source/context'
import { ChatStage } from '../../../src/layouts/ChatStage'
import { createPreviewSessions, previewProjects } from '../../../src/lib/fixtures'
import { useWorkspace } from '../../../src/store/workspace'

vi.mock('../../../src/router/hooks', () => ({ useCurrentPage: () => 'chat' }))
vi.mock('../../../src/components/DesktopUpdateButton', () => ({ DesktopUpdateButton: () => null }))
vi.mock('../../../src/components/source/ChangesView', () => ({
  ChangesPane: () => <div>Git contents</div>,
}))
vi.mock('../../../src/components/source/FilesPane', () => ({ FilesPane: () => null }))

let root: Root
let container: HTMLDivElement
async function toggle() {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('.source-toggle')!.click()
  })
  await act(async () => vi.advanceTimersByTime(300))
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
  vi.useFakeTimers()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1200,
  } as DOMRect)
  useWorkspace.setState({
    language: 'en',
    projects: structuredClone(previewProjects),
    sessions: createPreviewSessions(),
    activeSessionId: 'model-selector',
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <SourceProvider>
        <Header onRename={() => {}} />
        <ChatStage empty={false}>
          <p>Conversation</p>
        </ChatStage>
      </SourceProvider>,
    ),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('opens, closes and reopens the same sidebar through the header entry', async () => {
  const entry = container.querySelector<HTMLButtonElement>('.source-toggle')!
  expect(entry.getAttribute('aria-pressed')).toBe('false')
  await toggle()
  const panel = document.getElementById(entry.getAttribute('aria-controls')!)!
  expect(panel).toBeTruthy()
  expect(panel.classList.contains('is-open')).toBe(true)
  expect(entry.getAttribute('aria-pressed')).toBe('true')
  expect(panel.textContent).toContain('Git contents')
  await toggle()
  expect(entry.getAttribute('aria-pressed')).toBe('false')
  expect(panel.hidden).toBe(true)
  await toggle()
  expect(document.getElementById(entry.getAttribute('aria-controls')!)).toBe(panel)
  expect(panel.hidden).toBe(false)
  expect(panel.classList.contains('is-open')).toBe(true)
  expect(entry.getAttribute('aria-pressed')).toBe('true')
})
