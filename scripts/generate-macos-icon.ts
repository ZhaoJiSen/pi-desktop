import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = mkdtempSync(join(tmpdir(), 'pi-macos-icon-'))

try {
  execFileSync(
    process.execPath,
    [
      join(root, 'node_modules/@tauri-apps/cli/tauri.js'),
      'icon',
      join(root, 'src-tauri/icons/macos.svg'),
      '--output',
      output,
    ],
    { cwd: root, stdio: 'inherit' },
  )
  // macOS dev embeds this ICNS; keep other platforms' icon assets untouched.
  copyFileSync(join(output, 'icon.icns'), join(root, 'src-tauri/icons/icon.icns'))
} finally {
  rmSync(output, { recursive: true, force: true })
}
