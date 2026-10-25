// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WorkspacePageTitle } from '../../src/components/WorkspacePageTitle'
import {
  commandHeaderCount,
  usePublishCommandCount,
} from '../../src/pages/commands/commandHeaderCount'
import { useWorkspace } from '../../src/store/workspace'

function Publisher({
  filtered,
  total,
  loading,
}: {
  filtered: number
  total: number
  loading: boolean
}) {
  usePublishCommandCount(filtered, total, loading)
  return null
}
let root: Root, container: HTMLDivElement
async function show({ filtered = 145, total = 145, loading = false, publisher = true } = {}) {
  await act(async () =>
    root.render(
      <>
        <WorkspacePageTitle page="commands" />
        {publisher && <Publisher filtered={filtered} total={total} loading={loading} />}
      </>,
    ),
  )
}
const badge = () => container.querySelector('.workspace-command-count')!
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useWorkspace.setState({
    activeSessionId: 'count-session',
    piExecutable: 'pi',
    language: 'en',
    connection: 'connected',
  })
  commandHeaderCount.setState({ snapshot: null })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
it('keeps the confirmed count and badge node while the catalog is temporarily empty', async () => {
  await show()
  const original = badge()
  expect(original.textContent).toBe('145')
  expect(original.closest('.workspace-page-content, .workspace-page-loading')).toBeNull()
  await show({ filtered: 5, total: 5, loading: true })
  expect(badge()).toBe(original)
  expect(badge().textContent).toBe('145')
  await show({ filtered: 146, total: 146 })
  expect(badge()).toBe(original)
  expect(badge().textContent).toBe('146')
})
it('keeps the full count across navigation instead of restoring an old search count', async () => {
  await show({ filtered: 3 })
  expect(badge().textContent).toBe('3 / 145')
  await show({ publisher: false })
  await show({ filtered: 5, total: 5, loading: true })
  expect(badge().textContent).toBe('145')
  await show()
  expect(badge().textContent).toBe('145')
})
it('does not show the previous session count while a new session loads', async () => {
  await show()
  await show({ publisher: false })
  await act(async () => useWorkspace.setState({ activeSessionId: 'other-session' }))
  await show({ filtered: 5, total: 5, loading: true })
  expect(badge().textContent).toBe('—')
  await show({ filtered: 12, total: 12 })
  expect(badge().textContent).toBe('12')
})
