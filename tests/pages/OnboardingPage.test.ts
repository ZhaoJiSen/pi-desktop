// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  choose: vi.fn(),
  prepare: vi.fn(),
  defaultPath: vi.fn(),
  checkUpdate: vi.fn(),
  upgrade: vi.fn(),
  suppress: vi.fn(),
  plan: vi.fn(),
  install: vi.fn(),
}))
vi.mock('../../src/lib/piUpdates', () => ({
  PiReconnectError: class extends Error {},
  checkPiUpdate: mocks.checkUpdate,
  upgradePi: mocks.upgrade,
  suppressPiUpdatePrompt: mocks.suppress,
}))
vi.mock('../../src/lib/onboarding', () => ({
  inspectPiEnvironment: mocks.check,
  preparePiInstall: mocks.plan,
  installPi: mocks.install,
  chooseOnboardingProject: mocks.choose,
  prepareOnboardingWorkspace: mocks.prepare,
  onboardingDefaultPath: mocks.defaultPath,
}))
vi.mock('@heroui/react', async (importOriginal) => {
  const { ListBox, Skeleton, ProgressBar, AlertDialog } =
    await importOriginal<typeof import('@heroui/react')>()
  const { createContext, createElement, useContext } = await import('react')
  const FieldContext = createContext<{
    value?: string
    onChange?: (value: string) => void
  }>({})
  const RadioPressContext = createContext<(() => void) | undefined>(undefined)
  const Button = ({
    onPress,
    isDisabled,
    isPending: _pending,
    isIconOnly: _icon,
    variant: _variant,
    children,
    ...props
  }: Record<string, unknown>) =>
    createElement(
      'button',
      { ...props, onClick: onPress, disabled: isDisabled },
      children as React.ReactNode,
    )
  const Chip = ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    createElement('span', { className }, children)
  const Alert = ({
    children,
    className,
    status,
    ...props
  }: Record<string, unknown> & { children?: React.ReactNode }) =>
    createElement('div', { ...props, className, 'data-status': status }, children)
  Alert.Indicator = ({ children }: { children?: React.ReactNode }) =>
    createElement('div', null, children)
  Alert.Content = ({ children }: { children?: React.ReactNode }) =>
    createElement('div', null, children)
  Alert.Title = ({ children }: { children?: React.ReactNode }) =>
    createElement('strong', null, children)
  Alert.Description = ({ children }: { children?: React.ReactNode }) =>
    createElement('span', null, children)
  const TextField = ({
    children,
    className,
    value,
    onChange,
  }: {
    children?: React.ReactNode
    className?: string
    value?: string
    onChange?: (value: string) => void
  }) =>
    createElement(
      FieldContext.Provider,
      { value: { value, onChange } },
      createElement('div', { className }, children),
    )
  const Label = ({ children }: { children?: React.ReactNode }) =>
    createElement('label', null, children)
  const Description = ({ children }: { children?: React.ReactNode }) =>
    createElement('p', null, children)
  function Input({
    className,
    placeholder,
    id,
  }: {
    className?: string
    placeholder?: string
    id?: string
  }) {
    const field = useContext(FieldContext)
    return createElement('input', {
      id,
      className,
      placeholder,
      value: field.value ?? '',
      onInput: (event: Event) => field.onChange?.((event.currentTarget as HTMLInputElement).value),
    })
  }
  const RadioGroup = ({
    children,
    className,
    value,
    onChange: _onChange,
    isDisabled,
    ...props
  }: Record<string, unknown> & { children?: React.ReactNode }) =>
    createElement(
      'div',
      {
        ...props,
        className,
        role: 'radiogroup',
        'data-value': value,
        'data-disabled': isDisabled,
      },
      children,
    )
  function Radio({
    children,
    className,
    value,
    onPointerUp,
  }: {
    children?: React.ReactNode
    className?: string
    value?: string
    onPointerUp?: () => void
  }) {
    return createElement(
      RadioPressContext.Provider,
      { value: onPointerUp },
      createElement('div', { className, 'data-value': value }, children),
    )
  }
  Radio.Content = function RadioContent({
    children,
    className,
  }: {
    children?: React.ReactNode
    className?: string
  }) {
    const onPointerUp = useContext(RadioPressContext)
    return createElement('button', { type: 'button', className, onClick: onPointerUp }, children)
  }
  Radio.Control = ({ children }: { children?: React.ReactNode }) =>
    createElement('span', null, children)
  Radio.Indicator = () => createElement('span')
  return {
    Alert,
    Button,
    Chip,
    Description,
    Input,
    Label,
    ListBox,
    Radio,
    RadioGroup,
    Skeleton,
    ProgressBar,
    AlertDialog,
    TextField,
  }
})
vi.mock('motion/react', async () => {
  const { createElement } = await import('react')
  return {
    motion: {
      div: ({
        initial: _initial,
        animate: _animate,
        transition: _transition,
        children,
        ...props
      }: Record<string, unknown>) => createElement('div', props, children as React.ReactNode),
    },
  }
})
import { OnboardingPage } from '../../src/pages/OnboardingPage'
import { useWorkspace } from '../../src/store/workspace'
let root: Root, container: HTMLDivElement
const enter = vi.fn()
function readyReport(version = '1.0.0', authentication = 'ready') {
  return {
    kind: 'ready',
    environment: {
      executable: '/bin/pi',
      version,
      nodeVersion: 'v22',
      defaultWorkspace: '/home/Pi Desktop',
    },
    compatibility: version === '1.0.0' ? 'verified' : 'unverified',
    authentication,
    pathRecovered: false,
    discoveredExecutable: null,
    detail: null,
    canRepair: false,
  }
}
const missingReport = {
  kind: 'missing',
  environment: null,
  compatibility: 'unknown',
  authentication: 'unknown',
  pathRecovered: false,
  discoveredExecutable: null,
  detail: null,
  canRepair: false,
}
async function click(text: string) {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent === text)!
  expect(button, text).toBeDefined()
  await act(async () => button.click())
}
async function mount() {
  await act(async () => root.render(createElement(OnboardingPage, { onEnter: enter })))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.check.mockReset().mockResolvedValue(readyReport())
  mocks.choose.mockReset().mockResolvedValue({ path: '/home/project', branch: 'main' })
  mocks.prepare.mockReset().mockResolvedValue(undefined)
  mocks.defaultPath.mockReset().mockResolvedValue('/home/Pi Desktop')
  mocks.checkUpdate.mockReset().mockResolvedValue(null)
  mocks.suppress.mockReset().mockResolvedValue(undefined)
  mocks.upgrade.mockReset().mockImplementation(async () => {
    mocks.check.mockResolvedValue(readyReport('1.2.0'))
    mocks.checkUpdate.mockResolvedValue(null)
    return readyReport('1.2.0').environment
  })
  mocks.plan.mockReset().mockResolvedValue({
    id: 'plan-1',
    command: 'node npm-cli.js install --ignore-scripts @earendil-works/pi-coding-agent@1.0.0',
    source: 'https://registry.npmjs.org',
    version: '1.0.0',
    nodeVersion: 'v22.19.0',
    directory: '/home/isolated-pi',
  })
  mocks.install.mockReset().mockResolvedValue(readyReport())
  enter.mockReset()
  useWorkspace.setState({
    language: 'en',
    piExecutable: 'pi',
    piUpdating: false,
    onboardingCompleted: false,
    onboardingOpen: true,
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
describe('setup guide', () => {
  it('offers an inline upgrade after a successful installation check and shows the new version', async () => {
    mocks.checkUpdate.mockResolvedValue({
      executable: '/bin/pi',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0',
      hasUpdate: true,
    })
    await mount()
    await click('Continue')
    expect(mocks.checkUpdate).toHaveBeenCalledWith('/bin/pi')
    expect(container.textContent).toContain('A new Pi version is available')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    await click('Update now')
    expect(container.textContent).toContain('Pi 1.2.0')
    expect(container.textContent).not.toContain('A new Pi version is available')
  })
  it('keeps the installed CLI usable when the update check is offline', async () => {
    mocks.checkUpdate.mockRejectedValue(new Error('offline'))
    await mount()
    await click('Continue')
    expect(container.textContent).toContain('Pi CLI is ready')
    expect(container.textContent).not.toContain('offline')
    await click('Continue')
    expect(container.textContent).toContain('Start with your project')
  })
  it('keeps an upgrade failure visible with retry and manual instructions', async () => {
    mocks.checkUpdate.mockResolvedValue({
      executable: '/bin/pi',
      currentVersion: '1.0.0',
      latestVersion: '1.2.0',
      hasUpdate: true,
    })
    mocks.upgrade.mockRejectedValueOnce(new Error('Nix installation cannot self-update'))
    await mount()
    await click('Continue')
    await click('Update now')
    expect(container.textContent).toContain('Nix installation cannot self-update')
    expect(container.textContent).toContain('Official update instructions')
    await click('Retry update')
    expect(container.textContent).toContain('Pi 1.2.0')
  })
  it('checks Pi, selects a folder, creates the workspace, then completes', async () => {
    await mount()
    await click('Continue')
    expect(mocks.check).toHaveBeenCalledWith('pi')
    expect(container.textContent).toContain('Pi CLI is ready')
    expect(mocks.prepare).not.toHaveBeenCalled()
    await click('Continue')
    await click('Choose a project folderOpen an existing project for Pi to work in.')
    await click('Enter workspace')
    expect(mocks.prepare).toHaveBeenCalledWith({ path: '/home/project', branch: 'main' })
    expect(enter).toHaveBeenCalledWith(true)
    expect(useWorkspace.getState()).toMatchObject({
      onboardingCompleted: true,
      onboardingOpen: false,
      piExecutable: '/bin/pi',
    })
  })
  it('allows first-use skip without creating a project or connecting Pi', async () => {
    await mount()
    await click('Skip setup')
    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(enter).toHaveBeenCalledWith(false)
    expect(useWorkspace.getState().onboardingCompleted).toBe(true)
  })
  it('skips runtime startup even after Pi has been detected successfully', async () => {
    await mount()
    await click('Continue')
    expect(container.textContent).toContain('Pi CLI is ready')
    await click('Skip setup')
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(enter).toHaveBeenCalledWith(false)
    expect(useWorkspace.getState().onboardingCompleted).toBe(true)
  })
  it('keeps environment failures actionable and permits later configuration', async () => {
    mocks.check.mockRejectedValue(new Error('Pi executable missing'))
    await mount()
    await click('Continue')
    expect(container.textContent).toContain('Pi executable missing')
    expect(container.querySelector('a')?.href).toBe('https://pi.dev/')
    expect(
      [...container.querySelectorAll('button')].find((b) => b.textContent === 'Continue')?.disabled,
    ).toBe(true)
    await click('Set up later')
    await click('Enter workspace')
    expect(mocks.prepare).toHaveBeenCalledWith(null)
    expect(enter).toHaveBeenCalledWith(false)
  })
  it('retains the guide and selected project when preparation fails', async () => {
    mocks.prepare.mockRejectedValue(new Error('Folder not writable'))
    await mount()
    await click('Continue')
    await click('Continue')
    await click('Enter workspace')
    expect(container.textContent).toContain('Folder not writable')
    expect(enter).not.toHaveBeenCalled()
    expect(useWorkspace.getState().onboardingOpen).toBe(true)
    mocks.prepare.mockResolvedValue(undefined)
    await click('Enter workspace')
    expect(enter).toHaveBeenCalledOnce()
  })
  it('ignores a stale check after the executable path changes', async () => {
    let resolve!: (value: unknown) => void
    mocks.check.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    await mount()
    await click('Continue')
    const input = container.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        '/new/pi',
      )
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () =>
      resolve({
        ...readyReport(),
        environment: { ...readyReport().environment, executable: '/old/pi' },
      }),
    )
    expect(container.textContent).not.toContain('Pi CLI is ready')
    expect(input.value).toBe('/new/pi')
  })
  it('shows the executable resolved by the check instead of the command name', async () => {
    await mount()
    await click('Continue')
    expect(container.querySelector('input')?.value).toBe('/bin/pi')
  })
  it('uses the saved executable after workspace state is restored', async () => {
    const saved = '/Users/me/.nvm/versions/node/v24.18.0/bin/pi'
    mocks.check.mockResolvedValue({
      ...readyReport(),
      environment: { ...readyReport().environment, executable: saved },
    })
    await mount()
    await act(async () => useWorkspace.setState({ piExecutable: saved }))
    await click('Continue')
    expect(mocks.check).toHaveBeenCalledWith(saved)
    expect(container.querySelector('input')?.value).toBe(saved)
  })
  it('keeps a path the user edited when the saved executable arrives later', async () => {
    await mount()
    await click('Continue')
    const input = container.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        '/typed/pi',
      )
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => useWorkspace.setState({ piExecutable: '/restored/pi' }))
    expect(input.value).toBe('/typed/pi')
  })
  it('can close a reopened guide without changing its existing configuration', async () => {
    useWorkspace.setState({ onboardingCompleted: true, piExecutable: '/existing/pi' })
    await mount()
    await click('Return to workspace')
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(enter).not.toHaveBeenCalled()
    expect(useWorkspace.getState()).toMatchObject({
      piExecutable: '/existing/pi',
      onboardingOpen: false,
    })
  })
})

describe('environment diagnosis and confirmed installation', () => {
  it('shows the reviewed command and source before installing, then connects through normal setup', async () => {
    mocks.check.mockResolvedValue(missingReport)
    await mount()
    await click('Continue')
    expect(mocks.install).not.toHaveBeenCalled()
    await click('Review installation')
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      'https://registry.npmjs.org',
    )
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      '--ignore-scripts',
    )
    expect(mocks.install).not.toHaveBeenCalled()
    await click('Confirm and install')
    expect(mocks.install).toHaveBeenCalledWith('plan-1', expect.any(Function))
    expect(container.textContent).toContain('RPC check passed')
    await click('Continue')
    await click('Enter workspace')
    expect(enter).toHaveBeenCalledWith(true)
    expect(useWorkspace.getState().piExecutable).toBe('/bin/pi')
  })
  it('can cancel without installing and can keep using a manually specified path', async () => {
    mocks.check.mockResolvedValue(missingReport)
    await mount()
    await click('Continue')
    await click('Review installation')
    await click('Cancel')
    expect(mocks.install).not.toHaveBeenCalled()
    expect(container.querySelector('input')?.value).toBe('pi')
    expect(useWorkspace.getState().piExecutable).toBe('pi')
  })
  it('shows real progress and errors, blocks duplicate submissions and prepares a new retry', async () => {
    mocks.check.mockResolvedValue(missingReport)
    let reject!: (reason: Error) => void
    mocks.install.mockImplementation((_id, progress) => {
      progress({ stage: 'installing', stream: 'stdout', text: 'download started\n' })
      return new Promise((_resolve, fail) => {
        reject = fail
      })
    })
    await mount()
    await click('Continue')
    await click('Review installation')
    await click('Confirm and install')
    expect(document.body.textContent).toContain('download started')
    expect(document.querySelector('[role="progressbar"]')).not.toBeNull()
    await click('Installing Pi…')
    expect(mocks.install).toHaveBeenCalledOnce()
    for (const text of ['Skip setup', 'Back', 'Set up later']) {
      expect(
        [...container.querySelectorAll('button')].find((b) => b.textContent === text)?.disabled,
      ).toBe(true)
    }
    await act(async () => reject(new Error('Network offline')))
    expect(document.body.textContent).toContain('Network offline')
    expect(container.querySelector('input')?.value).toBe('pi')
    await click('Review and retry')
    expect(mocks.plan).toHaveBeenCalledTimes(2)
    expect(mocks.install).toHaveBeenCalledOnce()
  })
  it('does not offer installation when only the configured path is wrong', async () => {
    mocks.check.mockResolvedValue({
      ...missingReport,
      kind: 'pathProblem',
      discoveredExecutable: '/detected/pi',
    })
    await mount()
    await click('Continue')
    expect(container.textContent).toContain('configured Pi path is unavailable')
    expect(container.textContent).not.toContain('Review installation')
    mocks.check.mockResolvedValue(readyReport())
    await click('Use the detected Pi')
    expect(mocks.check).toHaveBeenLastCalledWith('/detected/pi')
    expect(mocks.plan).not.toHaveBeenCalled()
  })
  it('distinguishes unsupported versions, unverified versions and missing authentication', async () => {
    mocks.check.mockResolvedValue({
      ...readyReport('0.60.0'),
      kind: 'incompatible',
      compatibility: 'unsupported',
      authentication: 'unknown',
    })
    await mount()
    await click('Continue')
    expect(container.textContent).toContain('not supported')
    expect(container.textContent).not.toContain('RPC check passed')
    mocks.check.mockResolvedValue(readyReport('1.2.0', 'missing'))
    await click('Check environment')
    expect(container.textContent).not.toContain('not been fully verified')
    expect(container.textContent).not.toContain('Model credentials are available')
    expect(container.textContent).toContain('No model credentials')
    await click('Continue')
    expect(container.textContent).toContain('Start with your project')
  })
})
