import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { readBuildVersion } from './version.ts'

const version = readBuildVersion()
const directory = process.env.RUNNER_TEMP
if (!directory) {
  console.error('::error::RUNNER_TEMP is required to write the build configuration')
  process.exit(1)
}
writeFileSync(join(directory, 'pi-build-config.json'), JSON.stringify({ version }))
