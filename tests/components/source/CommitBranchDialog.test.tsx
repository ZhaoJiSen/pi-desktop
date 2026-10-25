// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CommitBranchDialog } from '../../../src/components/source/CommitBranchDialog'
import * as api from '../../../src/lib/source/api'
import type { BranchState } from '../../../src/lib/source/branches'
import { useWorkspace } from '../../../src/store/workspace'

let root: Root, container: HTMLDivElement, state: BranchState
const changed = vi.fn(),
  committed = vi.fn(),
  closed = vi.fn()
async function submit() {
  await act(async () => {
    document
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}
async function fill(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
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
  useWorkspace.setState({ language: 'en' })
  state = { current: 'main', head: 'abcd1234', operation: null, dirty: true }
  vi.spyOn(api, 'gitBranchState').mockImplementation(async () => structuredClone(state))
  vi.spyOn(api, 'gitCommitBranch').mockResolvedValue(undefined)
  changed.mockClear()
  committed.mockClear()
  closed.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <CommitBranchDialog
        open
        projectPath="/project"
        fromBranch="main"
        files={['a.ts']}
        onClose={closed}
        onCommitted={committed}
        onChanged={changed}
      />,
    ),
  )
  await fill('.commit-branch', 'review')
  await fill('.commit-message', 'Keep this message')
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('refreshes actual state after hook failure and resumes without creating the branch again', async () => {
  vi.mocked(api.gitCommitBranch).mockImplementationOnce(async () => {
    state.current = 'review'
    throw new Error('pre-commit hook rejected')
  })
  await submit()
  expect(changed).toHaveBeenCalledTimes(1)
  expect(committed).not.toHaveBeenCalled()
  expect(document.querySelector<HTMLInputElement>('.commit-branch')!.value).toBe('review')
  expect(document.querySelector<HTMLTextAreaElement>('.commit-message')!.value).toBe(
    'Keep this message',
  )
  expect(document.body.textContent).toContain('The branch was created')
  await submit()
  expect(api.gitCommitBranch).toHaveBeenLastCalledWith(
    '/project',
    'review',
    'Keep this message',
    ['a.ts'],
    {
      head: 'abcd1234',
      current: 'review',
      resume: true,
    },
  )
  expect(committed).toHaveBeenCalledTimes(1)
  expect(closed).toHaveBeenCalledTimes(1)
})
it('rejects a branch changed outside the dialog and refreshes the displayed state', async () => {
  state.current = 'other'
  await submit()
  expect(api.gitCommitBranch).not.toHaveBeenCalled()
  expect(changed).toHaveBeenCalledTimes(1)
  expect(document.body.textContent).toContain('The current branch changed')
})
it('keeps rejecting a resumed commit after HEAD changes on the same branch', async () => {
  vi.mocked(api.gitCommitBranch).mockImplementationOnce(async () => {
    state.current = 'review'
    throw new Error('pre-commit hook rejected')
  })
  await submit()
  state.head = 'external5678'
  await submit()
  await submit()
  expect(api.gitCommitBranch).toHaveBeenCalledTimes(1)
  expect(committed).not.toHaveBeenCalled()
  expect(closed).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('The current branch changed')
  expect(document.querySelector<HTMLTextAreaElement>('.commit-message')!.value).toBe(
    'Keep this message',
  )
})
it('blocks duplicate submits while a commit is pending', async () => {
  let finish!: () => void
  vi.mocked(api.gitCommitBranch).mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        finish = done
      }),
  )
  await submit()
  await submit()
  expect(api.gitCommitBranch).toHaveBeenCalledTimes(1)
  expect(document.querySelector<HTMLTextAreaElement>('.commit-message')!.disabled).toBe(true)
  await act(async () => finish())
})
