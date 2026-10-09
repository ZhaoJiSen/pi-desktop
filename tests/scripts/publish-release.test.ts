import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('../../scripts/publish-release.ts', import.meta.url))
let directory: string
let commit: string
let environment: NodeJS.ProcessEnv

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim()
}

function run(version = '0.2.0') {
  return spawnSync(process.execPath, ['--experimental-strip-types', script], {
    cwd: directory,
    env: { ...environment, BUILD_VERSION: version },
    encoding: 'utf8',
  })
}

beforeEach(() => {
  directory = realpathSync(mkdtempSync(join(tmpdir(), 'pi-release-test-')))
  git('init', '-q')
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--allow-empty',
    '-qm',
    'test',
  )
  commit = git('rev-parse', 'HEAD')
  mkdirSync(join(directory, 'bin'))
  mkdirSync(join(directory, 'assets'))
  writeFileSync(join(directory, 'assets', 'pi desktop.dmg'), 'test bundle')
  writeFileSync(join(directory, 'assets', 'ignored.txt'), 'not a bundle')
  // A local gh stub captures arguments; no GitHub calls or credentials are used.
  writeFileSync(
    join(directory, 'bin', 'gh'),
    '#!/bin/sh\nprintf "%s\\n" "$@" > "$RELEASE_TEST_LOG"\nexit "${RELEASE_TEST_EXIT:-0}"\n',
    { mode: 0o755 },
  )
  environment = {
    ...process.env,
    PATH: `${join(directory, 'bin')}:${process.env.PATH}`,
    GITHUB_REPOSITORY: 'test/pi-desktop',
    GITHUB_SHA: commit,
    GH_TOKEN: 'test-only',
    RELEASE_ASSET_DIR: 'assets',
    RELEASE_TEST_LOG: join(directory, 'arguments.txt'),
    RELEASE_TEST_EXIT: '0',
  }
})

afterEach(() => rmSync(directory, { recursive: true, force: true }))

describe('release publishing', () => {
  it('publishes only DMGs with release notes against the exact build commit', () => {
    expect(run().status).toBe(0)
    expect(readFileSync(environment.RELEASE_TEST_LOG!, 'utf8').trim().split('\n')).toEqual([
      'release',
      'create',
      'v0.2.0',
      join(directory, 'assets', 'pi desktop.dmg'),
      '--repo',
      'test/pi-desktop',
      '--target',
      commit,
      '--title',
      'pi-desktop 0.2.0',
      '--generate-notes',
    ])
  })

  it('marks a prerelease without making it latest', () => {
    expect(run('0.2.0-beta.1+build.2').status).toBe(0)
    const args = readFileSync(environment.RELEASE_TEST_LOG!, 'utf8')
    expect(args).toContain('v0.2.0-beta.1+build.2\n')
    expect(args).toContain('--prerelease\n--latest=false\n')
  })

  it('does not mistake a hyphen in build metadata for a prerelease', () => {
    expect(run('0.2.0+build-test').status).toBe(0)
    expect(readFileSync(environment.RELEASE_TEST_LOG!, 'utf8')).not.toContain('--prerelease')
  })

  it('rejects an existing tag pointing at another commit', () => {
    git('tag', 'v0.2.0')
    git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '--allow-empty',
      '-qm',
      'next',
    )
    environment.GITHUB_SHA = git('rev-parse', 'HEAD')
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('already points to a different commit')
    expect(() => readFileSync(environment.RELEASE_TEST_LOG!)).toThrow()
  })

  it('accepts an annotated tag already pointing at the build commit', () => {
    git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'tag',
      '-a',
      'v0.2.0',
      '-m',
      'release',
    )
    expect(run().status).toBe(0)
  })

  it('fails without publishing when the artifact contains no DMG', () => {
    rmSync(join(directory, 'assets', 'pi desktop.dmg'))
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('refusing to publish an empty release')
    expect(() => readFileSync(environment.RELEASE_TEST_LOG!)).toThrow()
  })

  it('propagates gh failures without retrying or overwriting an existing release', () => {
    environment.RELEASE_TEST_EXIT = '1'
    expect(run().status).toBe(1)
    const args = readFileSync(environment.RELEASE_TEST_LOG!, 'utf8')
    expect(args).toContain('release\ncreate\n')
    expect(args).not.toContain('--clobber')
  })

  it('rejects an invalid version before calling gh', () => {
    expect(run('v0.2.0').status).toBe(1)
    expect(() => readFileSync(environment.RELEASE_TEST_LOG!)).toThrow()
  })
})
