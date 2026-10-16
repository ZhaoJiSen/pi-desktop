// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoveConfirmationDialog } from '../../src/components/RemoveConfirmationDialog'
import { useWorkspace } from '../../src/store/workspace'

let root: Root
let container: HTMLDivElement
const close = vi.fn()
const confirm = vi.fn()

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  close.mockReset()
  confirm.mockReset()
  useWorkspace.setState({ language: 'en' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      createElement(RemoveConfirmationDialog, {
        title: 'Remove this conversation?',
        name: 'Draft',
        description: 'Remove this desktop conversation and its draft.',
        confirmLabel: 'Remove conversation',
        onClose: close,
        onConfirm: confirm,
      }),
    ),
  )
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('Remove confirmation dialog', () => {
  it('focuses the dialog instead of Cancel when it opens', () => {
    const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]')!
    const cancel = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === 'Cancel',
    )!
    const remove = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === 'Remove conversation',
    )!

    expect(document.activeElement).toBe(dialog)
    expect(document.activeElement).not.toBe(cancel)
    expect(document.activeElement).not.toBe(remove)
    expect(cancel.getAttribute('data-focus-visible')).not.toBe('true')
  })
})
