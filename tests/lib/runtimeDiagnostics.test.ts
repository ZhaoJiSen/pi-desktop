import { describe, expect, it } from 'vitest'
import { diagnosticNotice, isStaleExtensionContext } from '../../src/lib/desktop/diagnostics'

describe('runtime diagnostic boundaries', () => {
  const stale =
    'This extension ctx is stale after session replacement or reload. Do not use a captured pi or command ctx.'
  it('recognizes the failure line without mistaking source code for the failure', () => {
    expect(isStaleExtensionContext(stale)).toBe(true)
    expect(isStaleExtensionContext(`Error: ${stale}`)).toBe(true)
    expect(isStaleExtensionContext(`const message = "${stale}";`)).toBe(false)
    expect(isStaleExtensionContext('Error: API key not found')).toBe(false)
  })
  it('keeps actual errors while excluding stack frames and bundled code', () => {
    expect(diagnosticNotice('Error: EACCES: permission denied')).toBe(
      'Error: EACCES: permission denied',
    )
    expect(diagnosticNotice('Connection failed: socket closed')).toBe(
      'Connection failed: socket closed',
    )
    expect(diagnosticNotice('错误：无法打开文件')).toBe('错误：无法打开文件')
    expect(
      diagnosticNotice('function extractSpawnMarker(args) { throw new Error("failed") }'),
    ).toBeNull()
    expect(diagnosticNotice('at ErrorHandler (/tmp/extension.js:10:2)')).toBeNull()
    expect(diagnosticNotice('const error = ' + '{};'.repeat(3000))).toBeNull()
    expect(diagnosticNotice('Error: ' + 'x'.repeat(3000))).toHaveLength(500)
  })
})
