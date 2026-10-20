// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/store/workspace', () => ({
  useWorkspace: { getState: () => ({ language: 'en' }) },
}))

import type { ExtensionPackage } from '../../src/types'
import {
  getPackageBatch,
  isPackageBatchVisible,
  onPackageBatchNotice,
  resetPackageBatch,
  retainPackageBatchViewer,
  runPackageBatch,
} from '../../src/lib/packageBatch'

const pkg = (name: string): ExtensionPackage => ({
  source: `npm:${name}`,
  scope: 'global',
  version: '1.0.0',
})

afterEach(() => {
  resetPackageBatch()
  window.location.hash = ''
})

describe('package batch visibility', () => {
  it('keeps the result for the extensions page and toasts only after the route has left', async () => {
    const notices: Array<{ message: string; tone: string }> = []
    const stop = onPackageBatchNotice((notice) => notices.push(notice))
    const release = retainPackageBatchViewer('/project')
    window.location.hash = '#/extensions'
    let finish = () => {}
    const running = runPackageBatch({
      path: '/project',
      targets: [pkg('demo')],
      update: () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
      refresh: vi.fn(async () => {}),
      canReload: () => false,
      reload: vi.fn(async () => false),
    })
    expect(getPackageBatch()?.busy).toBe('batch')
    expect(isPackageBatchVisible('/project')).toBe(true)
    finish()
    await running
    expect(notices).toEqual([])
    expect(getPackageBatch()).toMatchObject({
      phase: 'settled',
      notice: 'Updated 1 packages',
      changed: true,
    })

    window.location.hash = '#/'
    const away = runPackageBatch({
      path: '/project',
      targets: [pkg('demo')],
      update: vi.fn(async () => {}),
      refresh: vi.fn(async () => {}),
      canReload: () => false,
      reload: vi.fn(async () => false),
    })
    await away
    expect(notices).toEqual([{ message: 'Updated 1 packages', tone: 'success' }])
    expect(getPackageBatch()?.notice).toBe('Updated 1 packages')
    release()
    stop()
  })

  it('warns when an update finishes away from the page with an error', async () => {
    const notices: Array<{ message: string; tone: string }> = []
    const stop = onPackageBatchNotice((notice) => notices.push(notice))
    window.location.hash = '#/'
    await runPackageBatch({
      path: '/project',
      targets: [pkg('demo')],
      update: async () => {},
      refresh: async () => {
        throw new Error('disk full')
      },
      canReload: () => false,
      reload: async () => false,
    })
    expect(notices).toEqual([{ message: 'disk full', tone: 'warning' }])
    stop()
  })
})
