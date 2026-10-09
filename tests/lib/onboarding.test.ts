import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), open: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }))
vi.mock('../../src/store/workspace', async (original) => {
  const module = await original<typeof import('../../src/store/workspace')>()
  return {
    ...module,
    isDesktop: true,
    useWorkspace: module.createWorkspaceStore({
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }),
  }
})
import { useWorkspace } from '../../src/store/workspace'
import {
  checkPiEnvironment,
  chooseOnboardingProject,
  onboardingDefaultPath,
  prepareOnboardingWorkspace,
} from '../../src/lib/onboarding'

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.open.mockReset()
  useWorkspace.setState({
    projects: [],
    sessions: [],
    activeSessionId: null,
    connection: 'disconnected',
    runningSessionId: null,
  })
  mocks.invoke.mockImplementation(async (name, args) => {
    if (name === 'default_workspace') return '/home/user/Pi Desktop'
    if (name === 'inspect_project') return { path: args.path, branch: 'main' }
    if (name === 'check_pi_environment')
      return {
        executable: '/bin/pi',
        version: '1.0.0',
        nodeVersion: 'v22',
        defaultWorkspace: '/home/user/Pi Desktop',
      }
  })
})
describe('onboarding native boundary', () => {
  it('detects without opening a runtime or changing workspace state', async () => {
    await checkPiEnvironment('  /bin/pi  ')
    expect(mocks.invoke).toHaveBeenCalledWith('check_pi_environment', { executable: '/bin/pi' })
    expect(useWorkspace.getState().sessions).toEqual([])
    expect(useWorkspace.getState().projects).toEqual([])
  })
  it('previewing and choosing folders never create a project or session', async () => {
    await onboardingDefaultPath()
    expect(mocks.invoke).toHaveBeenCalledWith('default_workspace', { create: false })
    mocks.open.mockResolvedValue(null)
    expect(await chooseOnboardingProject()).toBeNull()
    mocks.open.mockResolvedValue('/home/user/project')
    expect(await chooseOnboardingProject()).toEqual({ path: '/home/user/project', branch: 'main' })
    expect(useWorkspace.getState().projects).toEqual([])
  })
  it('creates only the confirmed project and reuses its first session on repeat entry', async () => {
    await prepareOnboardingWorkspace({ path: '/home/user/project', branch: null })
    const id = useWorkspace.getState().activeSessionId
    await prepareOnboardingWorkspace({ path: '/home/user/project', branch: null })
    expect(useWorkspace.getState().sessions).toHaveLength(1)
    expect(useWorkspace.getState().activeSessionId).toBe(id)
    expect(mocks.invoke.mock.calls.some(([name]) => name === 'default_workspace')).toBe(false)
  })
  it('creates the home workspace only on confirmation', async () => {
    await prepareOnboardingWorkspace(null)
    expect(mocks.invoke.mock.calls).toEqual([
      ['default_workspace', { create: true }],
      ['inspect_project', { path: '/home/user/Pi Desktop' }],
    ])
    expect(useWorkspace.getState().sessions).toHaveLength(1)
  })
  it('leaves state untouched after filesystem failure', async () => {
    mocks.invoke.mockRejectedValue(new Error('Permission denied'))
    await expect(prepareOnboardingWorkspace(null)).rejects.toThrow('Permission denied')
    expect(useWorkspace.getState()).toMatchObject({
      projects: [],
      sessions: [],
      onboardingCompleted: false,
    })
  })
})
