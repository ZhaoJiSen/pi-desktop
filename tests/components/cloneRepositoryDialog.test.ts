// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/store/workspace', async (original) => ({
  ...(await original<typeof import('../../src/store/workspace')>()),
  isDesktop: true,
}))
vi.mock('../../src/lib/desktop', () => ({ openProject: vi.fn() }))
vi.mock('../../src/router/navigation', () => ({ navigateToPage: vi.fn() }))
vi.mock('../../src/lib/repositories', async (original) => ({
  ...(await original<typeof import('../../src/lib/repositories')>()),
  cloneRepository: vi.fn(),
  cancelClone: vi.fn(),
}))
import { CloneRepositoryDialog } from '../../src/components/CloneRepositoryDialog'
import { cloneRepository, cancelClone, type CloneProgress } from '../../src/lib/repositories'
import { openProject } from '../../src/lib/desktop'
import { useWorkspace } from '../../src/store/workspace'

let root: Root, container: HTMLDivElement
const close = vi.fn()
function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (el) => el.textContent === label,
  )!
}
function input(label: string) {
  const id = [...document.querySelectorAll('label')].find((el) => el.textContent === label)!.htmlFor
  return document.getElementById(id) as HTMLInputElement
}
async function fill(label: string, value: string) {
  await act(async () => {
    const el = input(label)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.resetAllMocks()
  vi.mocked(cancelClone).mockResolvedValue(undefined)
  localStorage.clear()
  useWorkspace.setState({ language: 'en' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      createElement(CloneRepositoryDialog, {
        initialUrl: 'https://example.com/org/repo.git',
        onClose: close,
      }),
    ),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('clone repository dialog', () => {
  it('keeps empty fields neutral after blur and reports a nonempty invalid URL', async () => {
    await fill('Repository URL', '')
    await act(async () =>
      input('Repository URL').dispatchEvent(new FocusEvent('focusout', { bubbles: true })),
    )
    expect(input('Repository URL').getAttribute('aria-invalid')).not.toBe('true')
    expect(button('Clone and open').disabled).toBe(true)
    await fill('Repository URL', 'not-a-repository')
    expect(input('Repository URL').getAttribute('aria-invalid')).toBe('true')
    expect(document.body.textContent).toContain('Enter a valid HTTPS or SSH repository URL')
  })
  it('cancels on unmount and ignores a late successful checkout', async () => {
    let finish!: (value: string) => void
    vi.mocked(cloneRepository).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await act(async () => button('Clone and open').click())
    const taskId = vi.mocked(cloneRepository).mock.calls[0][0]
    await act(async () => root.render(null))
    expect(cancelClone).toHaveBeenCalledExactlyOnceWith(taskId)
    await act(async () => finish('/tmp/repo'))
    expect(openProject).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
  it('derives the folder until manually edited, and persists the successful location', async () => {
    expect(input('Folder name').value).toBe('repo')
    await fill('Repository URL', 'https://example.com/org/other.git')
    expect(input('Folder name').value).toBe('other')
    await fill('Folder name', 'custom')
    await fill('Repository URL', 'https://example.com/org/third.git')
    expect(input('Folder name').value).toBe('custom')
    await fill('Save location', '/tmp/projects')
    vi.mocked(cloneRepository).mockResolvedValue('/tmp/projects/custom')
    vi.mocked(openProject).mockResolvedValue('project')
    await act(async () => button('Clone and open').click())
    expect(openProject).toHaveBeenCalledExactlyOnceWith('/tmp/projects/custom')
    expect(close).toHaveBeenCalledOnce()
    expect(localStorage.getItem('pi-desktop.clone-parent')).toBe('/tmp/projects')
  })
  it('keeps progress, blocks duplicate submission and Escape, and restores inputs after cancellation', async () => {
    let finish!: (value: null) => void
    let report!: (value: CloneProgress) => void
    vi.mocked(cloneRepository).mockImplementation((_id, _url, _parent, _name, progress) => {
      report = progress
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    await act(async () => button('Clone and open').click())
    const taskId = vi.mocked(cloneRepository).mock.calls[0][0]
    await act(async () => report({ taskId, stage: 'receiving', percent: 42 }))
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('42')
    expect(input('Repository URL').disabled).toBe(true)
    await act(async () => {
      document
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      document
        .querySelector('[role="dialog"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(cloneRepository).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    await act(async () => button('Cancel clone').click())
    expect(cancelClone).toHaveBeenCalledExactlyOnceWith(taskId)
    await act(async () => finish(null))
    expect(input('Repository URL').disabled).toBe(false)
    expect(input('Folder name').value).toBe('repo')
    expect(openProject).not.toHaveBeenCalled()
  })
  it('preserves failed input and retries opening an already cloned repository without cloning twice', async () => {
    vi.mocked(cloneRepository).mockRejectedValueOnce({ code: 'auth' })
    await act(async () => button('Clone and open').click())
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('credentials')
    expect(input('Repository URL').value).toBe('https://example.com/org/repo.git')
    vi.mocked(cloneRepository).mockResolvedValue('/tmp/repo')
    vi.mocked(openProject)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce('project')
    await act(async () => button('Clone and open').click())
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Repository cloned')
    await act(async () => button('Open again').click())
    expect(cloneRepository).toHaveBeenCalledTimes(2)
    expect(openProject).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledOnce()
  })
})
