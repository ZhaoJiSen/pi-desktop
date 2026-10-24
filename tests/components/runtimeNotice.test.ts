// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeNotice } from '../../src/components/RuntimeNotice'
import { reportActionNotice, reportSuccessNotice } from '../../src/lib/notices'
import { reportPackageBatchNotice } from '../../src/lib/packageBatch'
import { useWorkspace } from '../../src/store/workspace'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useWorkspace.setState({ language: 'en', connectionError: 'still connected' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('action failure toast', () => {
  it('renders successful actions using the existing success toast and allows dismissal', async () => {
    await act(async () => root.render(createElement(RuntimeNotice)))
    await act(async () => reportSuccessNotice('Fetch completed'))
    const toast = document.querySelector('.runtime-notice')
    expect(toast?.textContent).toContain('Fetch completed')
    expect(toast?.className).not.toContain('is-warning')
    expect(toast?.querySelector('.runtime-notice-icon.is-success')).not.toBeNull()
    expect(toast?.getAttribute('data-placement')).toBe('bottom end')
    const close = toast?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
    await act(async () => close?.click())
    expect(document.querySelector('.runtime-notice')?.getAttribute('data-exiting')).toBe('true')
  })

  it('shows the sentence and the cause without treating it as a lost connection', async () => {
    await act(async () => root.render(createElement(RuntimeNotice)))
    await act(async () => {
      reportActionNotice(
        new Error('Could not open the project directory: No such file or directory (os error 2)'),
      )
    })
    const toast = document.querySelector('.runtime-notice.is-warning')
    expect(toast?.textContent).toContain('Could not open the project directory')
    expect(toast?.textContent).toContain('No such file or directory (os error 2)')
    expect(toast?.textContent).not.toContain('Reconnect')
    expect(document.querySelector('.runtime-notice-icon.is-warning')).not.toBeNull()
    expect(useWorkspace.getState().connectionError).toBe('still connected')
  })

  it('shows a package update that finished away from the extensions page', async () => {
    await act(async () => root.render(createElement(RuntimeNotice)))
    await act(async () => reportPackageBatchNotice('Updated 2 packages', 'success'))
    const toast = document.querySelector('.runtime-notice')
    expect(toast?.textContent).toContain('Updated 2 packages')
    expect(toast?.className).not.toContain('is-warning')
    expect(document.querySelector('.runtime-notice-icon.is-success')).not.toBeNull()
    await act(async () => reportPackageBatchNotice('Could not refresh packages', 'warning'))
    const failure = document.querySelector('.runtime-notice.is-warning')
    expect(failure?.textContent).toContain('Could not refresh packages')
    expect(failure?.querySelector('.runtime-notice-icon.is-warning')).not.toBeNull()
  })
})
