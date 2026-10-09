import process from 'node:process'

const semver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

export function readBuildVersion(): string {
  const version = process.env.BUILD_VERSION
  if (!version || version !== version.trim() || !semver.test(version)) {
    console.error('::error::version must be SemVer without a v prefix, e.g. 0.1.0 or 0.2.0-beta.1')
    process.exit(1)
  }
  return version
}
