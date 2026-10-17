// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ connect: vi.fn(async () => {}) }))
vi.mock('../../src/lib/desktop', () => ({ connectSession: mocks.connect }))
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

import { SettingsPage } from '../../src/pages/SettingsPage'
import { useWorkspace } from '../../src/store/workspace'

let root: Root
let container: HTMLDivElement

async function mount() {
  await act(async () => root.render(createElement(SettingsPage)))
}
function button(label: string) {
  return [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(label))
}
function pathField() {
  const field = container.querySelector<HTMLInputElement>('input[placeholder="pi"]')
  if (!field) throw new Error('missing path field')
  return field
}
async function setPath(value: string) {
  const field = pathField()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function frame() {
  const node = container.querySelector('.settings-theme-frame')
  if (!node) throw new Error('missing theme frame')
  return node
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.connect.mockReset().mockResolvedValue(undefined)
  useWorkspace.setState({
    language: 'en',
    theme: 'light',
    palette: 'ink',
    piExecutable: 'pi',
    activeSessionId: null,
    connection: 'disconnected',
    connectionError: null,
    runningSessionId: null,
    storageError: null,
    piUpdating: false,
    autoReloadAfterUpdate: true,
    autoReloadAfterToggle: true,
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('SettingsPage', () => {
  it('keeps appearance first and shows the saved connection', async () => {
    await mount()
    const headings = [...container.querySelectorAll('h2')].map((item) => item.textContent)
    expect(headings).toEqual(['Appearance', 'General', 'Extensions', 'Pi connection'])
    expect(container.textContent).toContain('Not connected')
    expect(frame().getAttribute('data-preview')).toBeNull()
  })

  it('previews a palette on the theme cards without saving it', async () => {
    await mount()
    const trigger = container.querySelector<HTMLButtonElement>('.settings-palette-select button')
    expect(trigger?.textContent).toContain('Ink')
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      trigger?.click()
    })
    const option = [...document.querySelectorAll('[role="option"]')].find((item) =>
      item.textContent?.includes('Gruvbox'),
    )
    expect(option).toBeTruthy()
    await act(async () => {
      option?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
      option?.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    })
    expect(frame().getAttribute('data-preview')).toBe('gruvbox')
    expect(useWorkspace.getState().palette).toBe('ink')
  })

  it('saves a path without reconnecting when no session is open', async () => {
    await mount()
    await setPath('/usr/local/bin/pi')
    expect(container.textContent).toContain('Not applied')
    await act(async () => button('Save and reconnect')?.click())
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(useWorkspace.getState().piExecutable).toBe('/usr/local/bin/pi')
    expect(container.textContent).toContain('Path saved')
    expect(container.textContent).not.toContain('Not applied')
  })

  it('reports reconnect success and keeps a failed path', async () => {
    useWorkspace.setState({ activeSessionId: 'session', connection: 'disconnected' })
    mocks.connect.mockImplementation(async () => {
      useWorkspace.setState({ connection: 'connected', connectionError: null })
    })
    await mount()
    await act(async () => button('Save and reconnect')?.click())
    expect(mocks.connect).toHaveBeenCalledWith('session', true)
    expect(container.textContent).toContain('Reconnected')

    mocks.connect.mockImplementation(async () => {
      useWorkspace.setState({ connection: 'error', connectionError: 'pi not found' })
    })
    await setPath('/missing/pi')
    await act(async () => button('Save and reconnect')?.click())
    expect(pathField().value).toBe('/missing/pi')
    expect(container.textContent).toContain('pi not found')
    expect(container.textContent).not.toContain('Reconnected')
    expect(container.textContent).not.toContain('Path saved')
  })

  it('explains why reconnect is unavailable while a session is running', async () => {
    useWorkspace.setState({
      activeSessionId: 'session',
      runningSessionId: 'session',
      connection: 'connected',
      piExecutable: '/usr/local/bin/pi',
    })
    await mount()
    const save = button('Save and reconnect')
    expect(save?.disabled).toBe(true)
    expect(container.textContent).toContain('A session is running')
    await act(async () => button('Restore to pi')?.click())
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(pathField().value).toBe('pi')
    expect(container.textContent).toContain('Not applied')
  })
})
