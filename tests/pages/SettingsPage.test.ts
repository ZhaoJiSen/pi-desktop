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

import { defaultFonts } from '../../src/lib/fonts'
import { SettingsPage } from '../../src/pages/SettingsPage'
import { useWorkspace } from '../../src/store/workspace'

let root: Root
let container: HTMLDivElement

async function mount(section: 'general' | 'appearance' | 'connection' = 'general') {
  await act(async () => {
    useWorkspace.setState({ settingsSection: section })
    root.render(createElement(SettingsPage))
  })
}
function button(label: string) {
  const target = [...container.querySelectorAll('button')].find((item) =>
    item.textContent?.includes(label),
  )
  if (!target) throw new Error(`missing button: ${label}`)
  return target
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
    palettesByMode: { light: 'ink', dark: 'ink' },
    accentOverrides: {},
    fonts: defaultFonts,
    piExecutable: 'pi',
    lastCustomPiExecutable: '',
    wrapLines: false,
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
  it('organizes settings into sections and keeps the saved controls mounted', async () => {
    await mount()
    const sections = [...container.querySelectorAll('.settings-navigation [role="option"]')].map(
      (item) => item.textContent,
    )
    expect(sections).toEqual([
      'General',
      'Appearance',
      'Shortcuts',
      'Extensions',
      'Pi connection',
    ])
    expect(container.querySelector('.settings-panel-heading h2')?.textContent).toBe('General')
    expect(
      container.querySelector('.settings-navigation [aria-selected="true"]')?.textContent,
    ).toBe('General')
    expect(container.textContent).toContain('Not connected')
    expect(container.textContent).toContain('Wrap text and code')
    const wrap = container.querySelector<HTMLInputElement>('.settings-inline-switch input')
    expect(wrap?.checked).toBe(false)
    await act(async () => wrap?.click())
    expect(useWorkspace.getState().wrapLines).toBe(true)
    expect(frame().getAttribute('data-preview')).toBeNull()
  })

  it('previews a palette on the theme cards without saving it', async () => {
    await mount('appearance')
    const trigger = container.querySelector<HTMLButtonElement>('.settings-palette-trigger')
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

  it('previews a larger code size until it is applied', async () => {
    await mount('appearance')
    const code = [...container.querySelectorAll('.settings-row')].find((row) =>
      row.textContent?.includes('Code size'),
    )
    const increase = [...(code?.querySelectorAll('button') ?? [])].find(
      (button) => button.getAttribute('aria-label') === 'Increase size',
    )
    await act(async () => increase?.click())
    expect(useWorkspace.getState().fonts.codeSize).toBe(13)
    expect(document.documentElement.style.getPropertyValue('--font-code-size')).not.toBe('14px')
    expect(container.querySelector<HTMLElement>('.font-preview-code')?.style.fontSize).toBe('14px')
    await act(async () => button('Apply')?.click())
    expect(useWorkspace.getState().fonts.codeSize).toBe(14)
    expect(document.documentElement.style.getPropertyValue('--font-code-size')).toBe('14px')
  })

  it('saves a path without reconnecting when no session is open', async () => {
    await mount('connection')
    await setPath('/usr/local/bin/pi')
    expect(container.textContent).toContain('Not applied')
    await act(async () => button('Save and reconnect')?.click())
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(useWorkspace.getState().piExecutable).toBe('/usr/local/bin/pi')
    expect(container.textContent).toContain('Path saved')
    expect(container.textContent).not.toContain('Not applied')
  })

  it('changes mode-specific names and rebuilds the accent swatches when switching modes', async () => {
    useWorkspace.setState({ palettesByMode: { light: 'min-dark', dark: 'catppuccin' } })
    await mount('appearance')
    expect(container.querySelector('.settings-palette-trigger')?.textContent).toContain('Min Light')
    const lightSwatches = [...container.querySelectorAll('.settings-accent-picker [role="option"]')]
    expect(lightSwatches).toHaveLength(9)
    await act(async () => useWorkspace.getState().setPreference({ theme: 'dark' }))
    expect(container.querySelector('.settings-palette-trigger')?.textContent).toContain(
      'Catppuccin Mocha',
    )
    const darkSwatches = [...container.querySelectorAll('.settings-accent-picker [role="option"]')]
    expect(darkSwatches).toHaveLength(9)
    expect(darkSwatches[1]?.id).not.toBe(lightSwatches[1]?.id)
    await act(async () => useWorkspace.getState().setPreference({ theme: 'light' }))
    expect(container.querySelector('.settings-palette-trigger')?.textContent).toContain('Min Light')
  })

  it.each([
    ['catppuccin-frappe', 'dark', 'Catppuccin Frappé'],
    ['catppuccin-macchiato', 'dark', 'Catppuccin Macchiato'],
    ['one-dark', 'light', 'One Light'],
    ['min-dark', 'light', 'Min Light'],
    ['rose-pine', 'light', 'Rosé Pine Dawn'],
    ['rose-pine-moon', 'dark', 'Rosé Pine Moon'],
    ['tokyo-night', 'light', 'Tokyo Night Day'],
    ['tokyo-night-storm', 'dark', 'Tokyo Night Storm'],
    ['tokyo-night-moon', 'dark', 'Tokyo Night Moon'],
  ] as const)('resolves the display name for %s in %s mode', async (palette, theme, label) => {
    useWorkspace.setState({
      theme,
      palettesByMode: { light: 'ink', dark: 'ink', [theme]: palette },
    })
    await mount('appearance')
    expect(container.querySelector('.settings-palette-trigger')?.textContent).toContain(label)
  })

  it('reports reconnect success and keeps a failed path', async () => {
    useWorkspace.setState({ activeSessionId: 'session', connection: 'disconnected' })
    mocks.connect.mockImplementation(async () => {
      useWorkspace.setState({ connection: 'connected', connectionError: null })
    })
    await mount('connection')
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

  it('keeps the custom path recoverable after saving the default command', async () => {
    useWorkspace.setState({ piExecutable: '/usr/local/bin/pi' })
    await mount('connection')
    await act(async () => button('Use default command (pi)').click())
    expect(pathField().value).toBe('pi')
    await act(async () => button('Save and reconnect').click())
    expect(useWorkspace.getState()).toMatchObject({
      piExecutable: 'pi',
      lastCustomPiExecutable: '/usr/local/bin/pi',
    })
    await act(async () => root.unmount())
    root = createRoot(container)
    await mount('connection')
    await act(async () => button('Restore custom path').click())
    expect(pathField().value).toBe('/usr/local/bin/pi')
    expect(container.textContent).toContain('Not applied')
    expect(mocks.connect).not.toHaveBeenCalled()
  })

  it('explains why reconnect is unavailable while a session is running', async () => {
    useWorkspace.setState({
      activeSessionId: 'session',
      runningSessionId: 'session',
      connection: 'connected',
      piExecutable: '/usr/local/bin/pi',
    })
    await mount('connection')
    const save = button('Save and reconnect')
    expect(save?.disabled).toBe(true)
    expect(container.textContent).toContain('A session is running')
    const restore = button('Use default command (pi)')
    expect(restore.disabled).toBe(true)
    await act(async () => restore.click())
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(pathField().value).toBe('/usr/local/bin/pi')
    expect(container.textContent).not.toContain('Not applied')
  })
})
