import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), desktop: true }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, isTauri: () => mocks.desktop }))
vi.mock('../../src/store/workspace', () => ({
  useWorkspace: {
    getState: () => ({
      language: 'en',
      piExecutable: 'pi',
      packages: [
        { source: 'npm:@demo/tool', scope: 'global', version: '1.0.0' },
        { source: 'npm:@demo/tool@2.0.0', scope: 'project', version: '2.0.0' },
        { source: 'npm:other', scope: 'global', version: '3.0.0' },
      ],
    }),
  },
}))
import {
  discoverPackages,
  packageInfo,
  packageMetadata,
  hasUpdate,
  npmName,
  managePackage,
} from '../../src/lib/packages'

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.desktop = true
})

describe('native package metadata bridge', () => {
  it('requests metadata and installed versions from Rust without browser networking', async () => {
    const info = {
      name: '@demo/tool',
      version: '2.0.0',
      newerThan: ['1.0.0'],
      description: '',
      author: '',
      license: '',
      resources: [],
    }
    mocks.invoke.mockResolvedValue(info)
    expect(await packageInfo('@demo/tool')).toBe(info)
    expect(mocks.invoke).toHaveBeenCalledWith('package_info', {
      name: '@demo/tool',
      installedVersions: ['1.0.0', '2.0.0'],
    })
    expect(hasUpdate('1.0.0', info)).toBe(true)
    expect(hasUpdate('2.0.0', info)).toBe(false)
  })
  it('delegates discovery and batch update queries to native commands', async () => {
    mocks.invoke.mockResolvedValue([])
    await discoverPackages('test')
    await packageMetadata([{ source: 'npm:demo', scope: 'global', version: '1.0.0' }])
    expect(mocks.invoke.mock.calls).toEqual([
      ['discover_packages', { query: 'test' }],
      [
        'extension_package_metadata',
        { packages: [{ source: 'npm:demo', scope: 'global', version: '1.0.0' }] },
      ],
    ])
  })
  it('drops an obsolete discovery response after the view aborts', async () => {
    let complete: (value: unknown) => void = () => {}
    mocks.invoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const controller = new AbortController()
    const request = discoverPackages('old', controller.signal)
    controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    complete([])
    await Promise.resolve()
  })
  it('does not start requests that have already been cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(discoverPackages('old', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(mocks.invoke).not.toHaveBeenCalled()
  })
  it('propagates native errors and gives browser previews a desktop-only message', async () => {
    mocks.invoke.mockRejectedValue('registry offline')
    await expect(packageInfo('demo')).rejects.toBe('registry offline')
    mocks.desktop = false
    await expect(discoverPackages('demo')).rejects.toThrow(
      'Manage installed packages in the desktop app.',
    )
  })
})

describe('package identity and installation boundary', () => {
  it('matches pinned and scoped npm names without conflating git or local sources', () => {
    expect(npmName('npm:@nicknisi/pi-answer@1.2.0')).toBe('@nicknisi/pi-answer')
    expect(npmName('npm:pi-web-access')).toBe('pi-web-access')
    for (const source of ['git:github.com/pi/tools', '../tools', 'npm:--help', 'npm:a b']) {
      expect(npmName(source)).toBeNull()
    }
  })
  it('does not claim installation succeeded in a browser or when pi rejects it', async () => {
    const pkg = { source: 'npm:pi-search', scope: 'project' as const }
    mocks.desktop = false
    await expect(managePackage('install', pkg, '/project')).rejects.toThrow()
    expect(mocks.invoke).not.toHaveBeenCalled()
    mocks.desktop = true
    mocks.invoke.mockRejectedValue(new Error('pi refused the installation'))
    await expect(managePackage('install', pkg, '/project')).rejects.toThrow('pi refused')
    expect(mocks.invoke).toHaveBeenCalledWith('manage_extension_package', {
      action: 'install',
      scope: 'project',
      source: 'npm:pi-search',
      path: '/project',
      executable: 'pi',
    })
  })
})
