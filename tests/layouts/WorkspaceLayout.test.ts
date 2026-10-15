// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtensionRequest } from '../../src/types'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, Channel: class {} }))
vi.mock('../../src/store/workspace', async (original) => ({
  ...(await original<typeof import('../../src/store/workspace')>()),
  isDesktop: true,
}))
vi.mock('../../src/router/hooks', () => ({ useCurrentPage: () => 'settings' }))
vi.mock('../../src/router/navigation', () => ({
  createChat: vi.fn(),
  navigateToPage: vi.fn(),
  selectChat: vi.fn(),
}))
vi.mock('../../src/hooks/useDesktopLifecycle', () => ({
  useDesktopLifecycle: () => ({ startup: 'loading' }),
}))
vi.mock('../../src/hooks/usePiUpdatePrompt', () => ({
  usePiUpdatePrompt: () => ({ update: null, dismiss: vi.fn() }),
}))
vi.mock('../../src/pages/OnboardingPage', () => ({
  OnboardingPage: () => createElement('p', null, 'Setup guide'),
}))
vi.mock('../../src/components/StartupScreen', () => ({
  StartupScreen: () => createElement('p', null, 'Reconnecting'),
}))
// Keep the real extension dialog and response path; replace only UI primitives.
vi.mock('@heroui/react', async (original) => {
  const module = await original<typeof import('@heroui/react')>()
  const { createElement } = await import('react')
  const content = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  return {
    ...module,
    Button: ({
      children,
      onPress,
      isDisabled,
    }: {
      children?: ReactNode
      onPress?: () => void
      isDisabled?: boolean
    }) => createElement('button', { onClick: onPress, disabled: isDisabled }, children),
    Modal: {
      Backdrop: content,
      Container: content,
      Dialog: ({ children }: { children?: ReactNode }) =>
        createElement('div', { role: 'dialog' }, children),
      Header: content,
      Heading: content,
      Body: content,
      Footer: content,
      CloseTrigger: () => null,
    },
  }
})

import { WorkspaceLayout } from '../../src/layouts/WorkspaceLayout'
import { handleEvent } from '../../src/lib/desktop/events'
import { runtimeState } from '../../src/lib/desktop/runtimeState'
import { useWorkspace } from '../../src/store/workspace'

let root: Root, container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.invoke.mockReset().mockResolvedValue(undefined)
  useWorkspace.setState({
    language: 'en',
    onboardingCompleted: true,
    onboardingOpen: true,
    piUpdating: true,
    connection: 'connecting',
    activeSessionId: null,
  })
  runtimeState.currentRun = {
    id: 'restoring-run',
    path: '/project',
    executable: '/bin/pi',
    sessionId: null,
    bindingVersion: 0,
    packages: [],
  }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  runtimeState.currentRun = null
  vi.unstubAllGlobals()
})

async function mount() {
  await act(async () => root.render(createElement(WorkspaceLayout)))
}
async function emit(request: ExtensionRequest) {
  await act(async () => {
    handleEvent({
      runId: 'restoring-run',
      event: { type: 'extension_ui_request', ...request },
    })
  })
}
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === text)
  expect(button).toBeDefined()
  await act(async () => button!.click())
}

describe('extension requests during inline Pi update recovery', () => {
  it.each(['confirm', 'input', 'select', 'editor'] as const)(
    'shows and answers %s requests while the setup guide is open',
    async (method) => {
      await mount()
      await emit({
        id: 'restore-question',
        method,
        title: 'Restore project access',
        prefill: 'saved answer',
        options: ['Allow access'],
      })
      expect(container.textContent).toContain('Setup guide')
      expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
        'Restore project access',
      )
      await click(method === 'select' ? 'Allow access' : 'Save')
      expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('pi_request', {
        runId: 'restoring-run',
        command: {
          type: 'extension_ui_response',
          id: 'restore-question',
          ...(method === 'confirm'
            ? { confirmed: true }
            : { value: method === 'select' ? 'Allow access' : 'saved answer' }),
        },
      })
      expect(container.querySelector('[role="dialog"]')).toBeNull()
      expect(useWorkspace.getState().piUpdating).toBe(true)
    },
  )

  it('preserves queued requests when moving from the guide to startup recovery', async () => {
    await mount()
    await emit({ id: 'first', method: 'confirm', title: 'First project' })
    await emit({ id: 'second', method: 'input', title: 'Second project', prefill: 'retained' })
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    await click('Save')
    await act(async () => useWorkspace.setState({ onboardingOpen: false }))
    expect(container.textContent).not.toContain('Setup guide')
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Second project')
    expect(container.querySelector('textarea')?.value).toBe('retained')
    await click('Save')
    expect(mocks.invoke).toHaveBeenLastCalledWith('pi_request', {
      runId: 'restoring-run',
      command: { type: 'extension_ui_response', id: 'second', value: 'retained' },
    })
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
