import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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

  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
  const dmgs = files.filter((name) => name.endsWith('.dmg'))
  if (!dmgs.length) throw new Error('No DMG files found; refusing to publish an empty release')
  const bundles = files.filter((name) => name.endsWith('.app.tar.gz'))
  if (bundles.length !== 1) throw new Error('Expected one universal macOS updater bundle')
  const bundle = bundles[0]
  const signatureFile = `${bundle}.sig`
  const signature = readFileSync(resolve(directory, signatureFile), 'utf8').trim()
  if (!signature) throw new Error('Updater bundle signature is empty')
  const assets = [...dmgs, bundle, signatureFile].sort().map((name) => resolve(directory, name))

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

  // Resolve once so reviewed notes also reach the in-app updater manifest.
  const authoredNotes = resolve('docs', 'releases', `${version}.md`)
  const notes = existsSync(authoredNotes)
    ? readFileSync(authoredNotes, 'utf8').trim()
    : execFileSync(
        'gh',
        [
          'api',
          `repos/${repository}/releases/generate-notes`,
          '--method',
          'POST',
          '-f',
          `tag_name=${tag}`,
          '-f',
          `target_commitish=${commit}`,
          '--jq',
          '.body',
        ],
        { encoding: 'utf8' },
      ).trim()
  if (!notes) throw new Error('Release notes are empty; refusing to publish')
  const notesFile = resolve(directory, 'release-notes.md')
  writeFileSync(notesFile, notes)

  const platform = {
    url: `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(bundle)}`,
    signature,
  }
  const manifest = resolve(directory, 'latest.json')
  writeFileSync(
    manifest,
    JSON.stringify(
      {
        version,
        notes,
        pub_date: new Date().toISOString(),
        platforms: { 'darwin-aarch64': platform, 'darwin-x86_64': platform },
      },
      null,
      2,
    ) + '\n',
  )
  assets.push(manifest)

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
    '--notes-file',
    notesFile,
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
