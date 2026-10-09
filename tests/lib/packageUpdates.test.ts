import { describe, expect, it, vi } from 'vitest'
import {
  checkPackageUpdates,
  clearCompletedPackageUpdates,
  summarizePackageCheck,
  updatablePackages,
  updatePackageBatch,
} from '../../src/lib/packageUpdates'
import type { PackageInfo } from '../../src/lib/packages'
import type { ExtensionPackage } from '../../src/types'

const info = (name: string): PackageInfo => ({
  name,
  version: '2.0.0',
  description: '',
  author: '',
  license: '',
  resources: [],
  newerThan: ['1.0.0'],
})
const pkg = (name: string, scope: 'global' | 'project' = 'global'): ExtensionPackage => ({
  source: `npm:${name}`,
  scope,
  version: '1.0.0',
})

describe('background update detection', () => {
  it('deduplicates npm names and shares in-flight requests and cached checks across mounts', async () => {
    const lookup = vi.fn(async (name) => info(name))
    const packages = [
      pkg('demo'),
      pkg('demo', 'project'),
      { source: '/local/tool', scope: 'global' as const },
    ]
    const first = checkPackageUpdates('/project', packages, lookup)
    const duplicate = checkPackageUpdates('/project', packages, lookup)
    expect(duplicate).toBe(first)
    const result = await first
    expect(result.items.demo.version).toBe('2.0.0')
    expect(lookup).toHaveBeenCalledTimes(1)
    await checkPackageUpdates('/project', packages, lookup)
    expect(lookup).toHaveBeenCalledTimes(1)
    await checkPackageUpdates('/project', packages, lookup, true)
    expect(lookup).toHaveBeenCalledTimes(2)
    // Returning from Discover to Installed after a manual check keeps the cache.
    await checkPackageUpdates('/project', packages, lookup)
    expect(lookup).toHaveBeenCalledTimes(2)
    await checkPackageUpdates('/other', packages, lookup)
    expect(lookup).toHaveBeenCalledTimes(3)
  })
  it('keeps successful metadata when one registry request fails, and limits concurrency to three', async () => {
    let concurrent = 0
    let peak = 0
    const lookup = async (name: string) => {
      peak = Math.max(peak, ++concurrent)
      await new Promise((resolve) => setTimeout(resolve, 1))
      concurrent--
      if (name === 'broken') throw new Error('offline')
      return info(name)
    }
    const result = await checkPackageUpdates(
      '/project',
      ['a', 'b', 'broken', 'c', 'd', 'e'].map((name) => pkg(name)),
      lookup,
    )
    expect(peak).toBe(3)
    expect(Object.keys(result.items)).toHaveLength(5)
    expect(result.errors).toEqual({ broken: 'offline' })
    expect(result.items.broken).toBeUndefined()
  })
  it('does not batch pinned, git, missing-version or unchecked packages', () => {
    const packages = [
      pkg('demo'),
      { ...pkg('demo'), source: 'npm:demo@1.0.0' },
      { ...pkg('other'), version: undefined },
      pkg('unchecked'),
      { source: 'git:github.com/pi/tool', scope: 'global' as const },
    ]
    expect(updatablePackages(packages, { demo: info('demo'), other: info('other') })).toEqual([
      pkg('demo'),
    ])
  })
  it('expires successful checks after five minutes', async () => {
    vi.useFakeTimers()
    try {
      const lookup = vi.fn(async (name) => info(name))
      await checkPackageUpdates('/project', [pkg('demo')], lookup)
      vi.advanceTimersByTime(300_001)
      await checkPackageUpdates('/project', [pkg('demo')], lookup)
      expect(lookup).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('update check overview', () => {
  it('never reports current when every registry request failed', () => {
    expect(
      summarizePackageCheck([pkg('a'), pkg('b')], {
        items: {},
        errors: { a: 'offline', b: 'timeout' },
      }),
    ).toEqual({ compared: 0, unknown: 0, failed: 2, status: 'failed' })
  })
  it('distinguishes partial checks, unavailable versions, an empty list and complete checks', () => {
    expect(
      summarizePackageCheck([pkg('a'), pkg('b')], {
        items: { a: info('a') },
        errors: { b: 'offline' },
      }).status,
    ).toBe('partial')
    expect(
      summarizePackageCheck([pkg('a'), { ...pkg('b'), version: undefined }], {
        items: { a: info('a'), b: info('b') },
        errors: {},
      }).status,
    ).toBe('partial')
    expect(
      summarizePackageCheck([{ ...pkg('a'), source: 'npm:a@1.0.0' }], {
        items: { a: info('a') },
        errors: {},
      }).status,
    ).toBe('unavailable')
    expect(summarizePackageCheck([], { items: {}, errors: {} }).status).toBe('empty')
    expect(summarizePackageCheck([pkg('a')], { items: { a: info('a') }, errors: {} }).status).toBe(
      'current',
    )
  })
})

describe('batch updates', () => {
  it('clears completed row indicators after single and mixed batch updates, preserving errors', () => {
    expect(clearCompletedPackageUpdates({ 'global:npm:demo': { status: 'done' } })).toEqual({})
    expect(
      clearCompletedPackageUpdates({
        'global:npm:demo': { status: 'done' },
        'global:npm:other': { status: 'failed', error: 'offline' },
      }),
    ).toEqual({ 'global:npm:other': { status: 'failed', error: 'offline' } })
  })

  it('runs serially and continues after a failure, reporting each outcome', async () => {
    const states: string[] = []
    let active = 0
    let peak = 0
    const result = await updatePackageBatch(
      ['a', 'b', 'c'].map((name) => pkg(name)),
      async (item) => {
        peak = Math.max(peak, ++active)
        await Promise.resolve()
        active--
        if (item.source === 'npm:b') throw new Error('pi update failed')
      },
      (item, state) =>
        states.push(`${item.source}:${state.status}${state.error ? ':' + state.error : ''}`),
    )
    expect(peak).toBe(1)
    expect(result).toEqual({ succeeded: 2, failed: 1 })
    expect(states).toEqual([
      'npm:a:updating',
      'npm:a:done',
      'npm:b:updating',
      'npm:b:failed:pi update failed',
      'npm:c:updating',
      'npm:c:done',
    ])
  })
})
