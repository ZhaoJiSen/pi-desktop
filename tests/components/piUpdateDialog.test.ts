// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/store/workspace', async (original) => ({
  ...(await original<typeof import('../../src/store/workspace')>()),
  isDesktop: true,
}))
vi.mock('../../src/router/navigation', () => ({ navigateToPage: vi.fn() }))
vi.mock('../../src/lib/piUpdates', () => ({
  PiReconnectError: class extends Error {},
  upgradePi: vi.fn(),
}))

import { PiUpdateDialog } from '../../src/components/PiUpdateDialog'
import { useWorkspace } from '../../src/store/workspace'
import { upgradePi, type PiUpdatePhase } from '../../src/lib/piUpdates'

let root: Root, container: HTMLDivElement
const close = vi.fn()
const offer = {
  executable: '/bin/pi',
  currentVersion: '1.1.0',
  latestVersion: '1.2.0',
  hasUpdate: true,
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  close.mockReset()
  vi.mocked(upgradePi).mockReset()
  useWorkspace.setState({ language: 'en', piUpdating: false })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(createElement(PiUpdateDialog, { update: offer, onClose: close })),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('Pi update alert dialog', () => {
  it('shows an update icon and keeps the native drag region inside the modal overlay', async () => {
    const dialog = document.querySelector('[role="alertdialog"]')!
    expect(dialog.querySelector('[data-slot="alert-dialog-icon"] svg')).not.toBeNull()
    const drag = document.querySelector<HTMLElement>('.pi-update-drag-region')!
    expect(drag.closest('[data-slot="alert-dialog-backdrop"]')).not.toBeNull()
    expect(drag.closest('[data-slot="alert-dialog-container"]')).not.toBeNull()
    expect(drag.closest('[inert]')).toBeNull()
    expect(drag.hasAttribute('data-tauri-drag-region')).toBe(true)
    expect(dialog.contains(drag)).toBe(false)

    // Tauri's native drag handler listens on document for mousedown events.
    const mouseDown = vi.fn()
    document.addEventListener('mousedown', mouseDown)
    try {
      await act(async () => {
        drag.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, detail: 1 }))
        drag.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, detail: 1 }))
        drag.click()
      })
      expect(mouseDown).toHaveBeenCalledTimes(1)
      expect(close).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('mousedown', mouseDown)
    }
    const later = [...dialog.querySelectorAll('button')].find(
      (item) => item.textContent === 'Later',
    )!
    expect(later.closest('[data-tauri-drag-region]')).toBeNull()
    await act(async () => later.click())
    expect(close).toHaveBeenCalledOnce()
  })

  it('keeps window dragging available while updating and ignores Escape', async () => {
    await act(async () => useWorkspace.setState({ piUpdating: true }))
    expect(document.querySelector('.pi-update-drag-region')).not.toBeNull()
    await act(async () => {
      document
        .querySelector('[role="alertdialog"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(close).not.toHaveBeenCalled()
  })

  it('shows indeterminate progress and phase labels, prevents duplicate updates, and restores retry after failure', async () => {
    let progress!: (phase: PiUpdatePhase) => void
    let fail!: (error: Error) => void
    vi.mocked(upgradePi).mockImplementation((_executable, onPhase) => {
      progress = onPhase
      onPhase('updating')
      return new Promise((_resolve, reject) => {
        fail = reject
      })
    })
    const submit = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Update now',
    )!
    await act(async () => submit.click())
    expect(submit.textContent).toBe('Updating Pi…')
    const bar = document.querySelector('[role="progressbar"]')!
    expect(bar).not.toBeNull()
    expect(bar.getAttribute('aria-label')).toBe('Updating Pi…')
    expect(bar.hasAttribute('aria-valuenow')).toBe(false)
    expect(submit.hasAttribute('data-pending')).toBe(true)
    expect(document.querySelector('.pi-update-content')?.getAttribute('aria-busy')).toBe('true')
    const later = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Later',
    )!
    expect(later.disabled).toBe(true)
    await act(async () => submit.click())
    expect(upgradePi).toHaveBeenCalledOnce()

    await act(async () => progress('reconnecting'))
    expect(submit.textContent).toBe('Reconnecting Pi…')
    expect(bar.getAttribute('aria-label')).toBe('Reconnecting Pi…')
    expect(bar.hasAttribute('aria-valuenow')).toBe(false)
    await act(async () => fail(new Error('Update failed')))
    expect(submit.textContent).toBe('Retry update')
    expect(document.querySelector('[role="progressbar"]')).toBeNull()
    expect(submit.hasAttribute('data-pending')).toBe(false)
    expect(later.disabled).toBe(false)
  })
})
