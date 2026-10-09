import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { readBuildVersion } from './version.ts'

function publishRelease() {
  const version = readBuildVersion()
  const repository = process.env.GITHUB_REPOSITORY
  const commit = process.env.GITHUB_SHA
  const directory = process.env.RELEASE_ASSET_DIR
  if (!repository || !commit || !directory || !process.env.GH_TOKEN) {
    throw new Error('GITHUB_REPOSITORY, GITHUB_SHA, RELEASE_ASSET_DIR and GH_TOKEN are required')
  }

  const assets = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.dmg'))
    .map((entry) => resolve(directory, entry.name))
    .sort()
  if (!assets.length) throw new Error('No DMG files found; refusing to publish an empty release')

  const tag = `v${version}`
  const existingTag = execFileSync('git', ['tag', '--list', tag], { encoding: 'utf8' }).trim()
  if (existingTag) {
    const taggedCommit = execFileSync('git', ['rev-parse', `refs/tags/${tag}^{commit}`], {
      encoding: 'utf8',
    }).trim()
    if (taggedCommit !== commit) {
      throw new Error(`${tag} already points to a different commit; choose a new version`)
    }
  }

  const args = [
    'release',
    'create',
    tag,
    ...assets,
    '--repo',
    repository,
    '--target',
    commit,
    '--title',
    `pi-desktop ${version}`,
    '--generate-notes',
  ]
  if (version.split('+')[0].includes('-')) args.push('--prerelease', '--latest=false')

  // Create only: published releases and their assets are never overwritten on a rerun.
  execFileSync('gh', args, { stdio: 'inherit' })
}

try {
  publishRelease()
} catch (error) {
  console.error(`::error::${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
