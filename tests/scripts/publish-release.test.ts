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
  writeFileSync(join(directory, 'assets', 'pi desktop.app.tar.gz'), 'updater bundle')
  writeFileSync(join(directory, 'assets', 'pi desktop.app.tar.gz.sig'), 'test-signature\n')
  // A local gh stub captures arguments; no GitHub calls or credentials are used.
  writeFileSync(
    join(directory, 'bin', 'gh'),
    '#!/bin/sh\nif [ "$1" = "api" ]; then\n  printf "%s\\n" "$@" > "$RELEASE_TEST_LOG.api"\n  printf "%s\\n" "$RELEASE_TEST_NOTES"\n  exit "${RELEASE_TEST_NOTES_EXIT:-0}"\nfi\nprintf "%s\\n" "$@" > "$RELEASE_TEST_LOG"\nexit "${RELEASE_TEST_EXIT:-0}"\n',
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
    RELEASE_TEST_NOTES:
      '## What’s changed\n* Improved desktop updates.\n* Fixed background downloads.',
    RELEASE_TEST_NOTES_EXIT: '0',
  }
})

afterEach(() => rmSync(directory, { recursive: true, force: true }))

describe('release publishing', () => {
  it('shares reviewed version notes between the release and updater manifest', () => {
    const notes = '## 新增\n\n- 支持后台下载应用更新。\n\n## 修复\n\n- 修复系统主题跟随。'
    mkdirSync(join(directory, 'docs', 'releases'), { recursive: true })
    writeFileSync(join(directory, 'docs', 'releases', '0.3.1.md'), notes + '\n')
    expect(run('0.3.1').status).toBe(0)
    expect(JSON.parse(readFileSync(join(directory, 'assets', 'latest.json'), 'utf8')).notes).toBe(
      notes,
    )
    expect(readFileSync(join(directory, 'assets', 'release-notes.md'), 'utf8')).toBe(notes)
    expect(() => readFileSync(`${environment.RELEASE_TEST_LOG}.api`)).toThrow()
  })

  it('rejects empty reviewed release notes without publishing', () => {
    mkdirSync(join(directory, 'docs', 'releases'), { recursive: true })
    writeFileSync(join(directory, 'docs', 'releases', '0.3.1.md'), '\n  \n')
    expect(run('0.3.1').status).toBe(1)
    expect(() => readFileSync(environment.RELEASE_TEST_LOG!)).toThrow()
  })
  it('publishes signed macOS updates and DMGs against the exact build commit', () => {
    expect(run().status).toBe(0)
    expect(readFileSync(environment.RELEASE_TEST_LOG!, 'utf8').trim().split('\n')).toEqual([
      'release',
      'create',
      'v0.2.0',
      join(directory, 'assets', 'pi desktop.app.tar.gz'),
      join(directory, 'assets', 'pi desktop.app.tar.gz.sig'),
      join(directory, 'assets', 'pi desktop.dmg'),
      join(directory, 'assets', 'latest.json'),
      '--repo',
      'test/pi-desktop',
      '--target',
      commit,
      '--title',
      'pi-desktop 0.2.0',
      '--notes-file',
      join(directory, 'assets', 'release-notes.md'),
    ])
  })

  it('writes both Mac architectures using the universal signed bundle', () => {
    expect(run().status).toBe(0)
    const manifest = JSON.parse(readFileSync(join(directory, 'assets', 'latest.json'), 'utf8'))
    expect(manifest.version).toBe('0.2.0')
    expect(manifest.notes).toBe(environment.RELEASE_TEST_NOTES)
    expect(readFileSync(join(directory, 'assets', 'release-notes.md'), 'utf8')).toBe(manifest.notes)
    expect(manifest.platforms['darwin-aarch64']).toEqual({
      url: 'https://github.com/test/pi-desktop/releases/download/v0.2.0/pi%20desktop.app.tar.gz',
      signature: 'test-signature',
    })
    expect(manifest.platforms['darwin-x86_64']).toEqual(manifest.platforms['darwin-aarch64'])
  })

  it('requests release notes for the exact tag and commit without publishing', () => {
    expect(run().status).toBe(0)
    expect(readFileSync(`${environment.RELEASE_TEST_LOG}.api`, 'utf8').trim().split('\n')).toEqual([
      'api',
      'repos/test/pi-desktop/releases/generate-notes',
      '--method',
      'POST',
      '-f',
      'tag_name=v0.2.0',
      '-f',
      `target_commitish=${commit}`,
      '--jq',
      '.body',
    ])
  })

  it('does not publish if release notes cannot be generated', () => {
    environment.RELEASE_TEST_NOTES_EXIT = '1'
    expect(run().status).toBe(1)
    expect(() => readFileSync(environment.RELEASE_TEST_LOG!)).toThrow()
  })

  it('refuses publishing without a signed updater bundle', () => {
    rmSync(join(directory, 'assets', 'pi desktop.app.tar.gz'))
    expect(run().status).toBe(1)
    expect(() => readFileSync(environment.RELEASE_TEST_LOG!)).toThrow()
  })

  it('refuses publishing an empty signature', () => {
    writeFileSync(join(directory, 'assets', 'pi desktop.app.tar.gz.sig'), '')
    expect(run().status).toBe(1)
    expect(() => readFileSync(environment.RELEASE_TEST_LOG!)).toThrow()
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
