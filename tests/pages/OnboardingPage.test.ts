// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  choose: vi.fn(),
  prepare: vi.fn(),
  defaultPath: vi.fn(),
}))
vi.mock('../../src/lib/onboarding', () => ({
  checkPiEnvironment: mocks.check,
  chooseOnboardingProject: mocks.choose,
  prepareOnboardingWorkspace: mocks.prepare,
  onboardingDefaultPath: mocks.defaultPath,
}))
vi.mock('@heroui/react', async (importOriginal) => {
  const { ListBox, Skeleton } = await importOriginal<typeof import('@heroui/react')>()
  const { createContext, createElement, useContext } = await import('react')
  const FieldContext = createContext<{
    value?: string
    onChange?: (value: string) => void
  }>({})
  const RadioPressContext = createContext<(() => void) | undefined>(undefined)
  const Button = ({
    onPress,
    isDisabled,
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
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(
    (item) => item.textContent === text,
  )!
  expect(button, text).toBeDefined()
  await act(async () => button.click())
}
async function mount() {
  await act(async () => root.render(createElement(OnboardingPage, { onEnter: enter })))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.check.mockReset().mockResolvedValue({
    executable: '/bin/pi',
    version: '1.0.0',
    nodeVersion: 'v22',
    defaultWorkspace: '/home/Pi Desktop',
  })
  mocks.choose.mockReset().mockResolvedValue({ path: '/home/project', branch: 'main' })
  mocks.prepare.mockReset().mockResolvedValue(undefined)
  mocks.defaultPath.mockReset().mockResolvedValue('/home/Pi Desktop')
  enter.mockReset()
  useWorkspace.setState({
    language: 'en',
    piExecutable: 'pi',
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
    await act(async () => resolve({ executable: '/old/pi', version: '1.0.0' }))
    expect(container.textContent).not.toContain('Pi CLI is ready')
    expect(input.value).toBe('/new/pi')
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
