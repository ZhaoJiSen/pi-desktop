// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/store/workspace', async (original) => ({
  ...(await original<typeof import('../../src/store/workspace')>()),
  isDesktop: true,
}))
vi.mock('../../src/lib/onboarding', () => ({ preparePiInstall: vi.fn(), installPi: vi.fn() }))
import { PiInstallPanel } from '../../src/components/PiInstallPanel'
import {
  preparePiInstall,
  installPi,
  type PiDiagnosis,
  type PiInstallProgress,
} from '../../src/lib/onboarding'
import { useWorkspace } from '../../src/store/workspace'

let root: Root, container: HTMLDivElement
const installed = vi.fn(),
  busy = vi.fn()
const plan = {
  id: 'reviewed',
  command: 'npm install --ignore-scripts @earendil-works/pi-coding-agent@1.0.0',
  source: 'https://registry.npmjs.org',
  version: '1.0.0',
  directory: '/isolated/pi',
  nodeVersion: 'v24.18.0',
}
function dialog() {
  return document.querySelector<HTMLElement>('[role="alertdialog"]')
}
async function click(label: string) {
  const button = [...(dialog() ?? container).querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent === label,
  )!
  expect(button).toBeDefined()
  await act(async () => button.click())
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  installed.mockReset()
  busy.mockReset()
  vi.mocked(preparePiInstall).mockReset().mockResolvedValue(plan)
  vi.mocked(installPi).mockReset()
  useWorkspace.setState({ language: 'en', piUpdating: false })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      createElement(PiInstallPanel, {
        executable: '/missing/pi',
        onInstalled: installed,
        onBusyChange: busy,
      }),
    ),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('Pi installation alert dialog', () => {
  it('opens a reviewed plan in a modal with an inline icon and native window drag region', async () => {
    expect(dialog()).toBeNull()
    expect(container.textContent).not.toContain(plan.command)
    await click('Review installation')
    expect(dialog()?.textContent).toContain(plan.command)
    expect(dialog()?.textContent).toContain(plan.source)
    expect(dialog()?.querySelector('[data-slot="alert-dialog-icon"] svg')).not.toBeNull()
    const drag = document.querySelector('.pi-install-drag-region')!
    expect(drag.closest('[data-slot="alert-dialog-container"]')).not.toBeNull()
    expect(drag.closest('[inert]')).toBeNull()
    expect(drag.hasAttribute('data-tauri-drag-region')).toBe(true)
    expect(dialog()?.contains(drag)).toBe(false)
    expect(dialog()?.querySelector('.pi-install-plan')?.hasAttribute('open')).toBe(true)
    expect(installPi).not.toHaveBeenCalled()
    const backdrop = document.querySelector<HTMLElement>('[data-slot="alert-dialog-backdrop"]')!
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      backdrop.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
      backdrop.click()
    })
    expect(dialog()).not.toBeNull()
    await click('Cancel')
    expect(dialog()).toBeNull()
    await click('Review installation')
    expect(preparePiInstall).toHaveBeenCalledTimes(2)
    expect(installPi).not.toHaveBeenCalled()
  })

  it('locks dismissal and duplicate submissions while showing installation and verification progress', async () => {
    let progress!: (event: PiInstallProgress) => void, fail!: (reason: Error) => void
    vi.mocked(installPi).mockImplementation((_id, onProgress) => {
      progress = onProgress
      return new Promise((_resolve, reject) => {
        fail = reject
      })
    })
    await click('Review installation')
    await click('Confirm and install')
    await act(async () =>
      progress({ stage: 'installing', stream: 'stdout', text: 'Downloading package\n' }),
    )
    expect(dialog()?.textContent).toContain('Downloading package')
    expect(dialog()?.querySelector('.pi-install-plan')?.hasAttribute('open')).toBe(false)
    expect(dialog()?.querySelector('[role="progressbar"]')?.hasAttribute('aria-valuenow')).toBe(
      false,
    )
    await click('Installing Pi…')
    await click('Cancel')
    await act(async () =>
      dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    )
    expect(dialog()).not.toBeNull()
    expect(installPi).toHaveBeenCalledOnce()
    await act(async () => progress({ stage: 'verifying', stream: null, text: null }))
    expect(dialog()?.textContent).toContain('Verifying version and RPC…')
    await act(async () => fail(new Error('Network unavailable')))
    expect(dialog()?.textContent).toContain('Network unavailable')
    expect(dialog()?.querySelector('[role="progressbar"]')).toBeNull()
    await click('Review and retry')
    expect(preparePiInstall).toHaveBeenCalledTimes(2)
    await click('Cancel')
    expect(dialog()).toBeNull()
  })

  it('keeps requirement errors and retry inside the dialog, then closes after successful installation', async () => {
    vi.mocked(preparePiInstall).mockRejectedValueOnce(new Error('Node.js is required'))
    await click('Review installation')
    expect(dialog()?.textContent).toContain('Node.js is required')
    expect(installPi).not.toHaveBeenCalled()
    await click('Review and retry')
    const report: PiDiagnosis = {
      kind: 'ready',
      environment: {
        executable: '/isolated/pi',
        version: '1.0.0',
        nodeVersion: 'v24.18.0',
        defaultWorkspace: '/workspace',
      },
      compatibility: 'verified',
      authentication: 'missing',
      pathRecovered: false,
      discoveredExecutable: null,
      detail: null,
      canRepair: false,
    }
    vi.mocked(installPi).mockResolvedValue(report)
    await click('Confirm and install')
    expect(installed).toHaveBeenCalledWith(report)
    expect(dialog()).toBeNull()
    expect(busy).toHaveBeenLastCalledWith(false)
  })
})
