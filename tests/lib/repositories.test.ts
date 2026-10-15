import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  channels: [] as { onmessage: (event: unknown) => void }[],
}))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  Channel: class {
    onmessage = (_event: unknown) => {}
    constructor() {
      mocks.channels.push(this)
    }
  },
}))
vi.mock('../../src/store/workspace', async (original) => ({
  ...(await original<typeof import('../../src/store/workspace')>()),
  isDesktop: true,
}))
import {
  cloneRepository,
  cloneTarget,
  repositoryName,
  repositoryUrl,
  validRepositoryName,
  cloneError,
} from '../../src/lib/repositories'
import { useWorkspace } from '../../src/store/workspace'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.channels.length = 0
  useWorkspace.setState({
    language: 'en',
    piUpdating: false,
    runningSessionId: null,
    connection: 'disconnected',
  })
})

describe('repository addresses', () => {
  it.each([
    'https://github.com/org/repo.git',
    'https://gitlab.example.com/group/subgroup/repo',
    'ssh://git@example.com:2222/org/repo.git',
    'git@example.com:org/repo.git',
  ])('accepts %s', (url) => expect(repositoryUrl(` ${url} `)).toBe(url))
  it.each([
    '',
    'org/repo',
    '/tmp/repo',
    'file:///tmp/repo',
    '--upload-pack=sh',
    'https://token@example.com/repo',
    'https://user:secret@example.com/repo',
    'https://example.com/repo?token=secret',
    'https://example.com',
    'git@host:',
    'git@host:re po',
  ])('rejects %s', (url) => expect(repositoryUrl(url)).toBeNull())
  it('derives names and renders native paths', () => {
    expect(repositoryName('git@example.com:org/my-repo.git')).toBe('my-repo')
    expect(repositoryName('https://example.com/org/%E9%A1%B9%E7%9B%AE.git')).toBe('项目')
    expect(cloneTarget('~/Projects/', 'repo')).toBe('~/Projects/repo')
    expect(cloneTarget('C:\\Projects\\', 'repo')).toBe('C:\\Projects\\repo')
    expect(cloneTarget('/', 'repo')).toBe('/repo')
  })
  it.each(['', '..', '../repo', 'x/y', 'x\\y', 'CON.txt', 'nul', 'COM1', 'repo.', 'repo '])(
    'rejects folder %s',
    (name) => expect(validRepositoryName(name)).toBe(false),
  )
})

describe('native clone operations', () => {
  it('filters unrelated and late progress and returns the completed local path', async () => {
    let finish!: (path: string) => void
    mocks.invoke.mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve
      }),
    )
    const progress = vi.fn()
    const operation = cloneRepository(
      'one',
      'https://example.com/repo',
      '~/Projects',
      'repo',
      progress,
    )
    const event = { taskId: 'one', stage: 'receiving', percent: 42 }
    mocks.channels[0].onmessage({ ...event, taskId: 'other' })
    mocks.channels[0].onmessage(event)
    expect(progress).toHaveBeenCalledExactlyOnceWith(event)
    finish('/Users/test/Projects/repo')
    expect(await operation).toBe('/Users/test/Projects/repo')
    mocks.channels[0].onmessage(event)
    expect(progress).toHaveBeenCalledOnce()
  })
  it('never starts while the agent is busy and never exposes remote error output', async () => {
    useWorkspace.setState({ runningSessionId: 'busy' })
    await expect(
      cloneRepository('one', 'https://example.com/repo', '~/Projects', 'repo', vi.fn()),
    ).rejects.toMatchObject({ code: 'busy' })
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(cloneError({ code: 'auth', detail: 'secret-token' })).not.toContain('secret-token')
  })
})
