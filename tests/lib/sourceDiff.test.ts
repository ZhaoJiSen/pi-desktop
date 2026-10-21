import { describe, expect, it } from 'vitest'
import {
  countPatch,
  ensureUnifiedPatch,
  isBinaryPatch,
  toolDiffToUnified,
} from '../../src/lib/source/diff'

const unified = `diff --git a/src/models.ts b/src/models.ts
--- a/src/models.ts
+++ b/src/models.ts
@@ -1,3 +1,4 @@
 export const models = [
   { id: "claude-sonnet", provider: "anthropic" },
+  { id: "gpt-5", provider: "openai" },
 ]
`

describe('unified diffs', () => {
  it('counts added and removed lines without treating headers as changes', () => {
    expect(countPatch(unified)).toEqual({ additions: 1, deletions: 0 })
    expect(countPatch('@@ -1,2 +1,2 @@\n-old\n+new\n same\n')).toEqual({
      additions: 1,
      deletions: 1,
    })
  })

  it('adds file headers when a patch is only hunks', () => {
    const patch = ensureUnifiedPatch('src/models.ts', '@@ -1 +1 @@\n-old\n+new\n')
    expect(patch.startsWith('diff --git a/src/models.ts b/src/models.ts\n')).toBe(true)
    expect(patch).toContain('@@ -1 +1 @@')
    expect(ensureUnifiedPatch('src/models.ts', unified)).toBe(unified)
  })

  it('turns tool rows into one unified hunk', () => {
    const patch = toolDiffToUnified('note.ts', [
      { kind: 'remove', text: 'before', number: 4 },
      { kind: 'add', text: 'after', number: 4 },
    ])
    expect(patch).toContain('@@ -4,1 +4,1 @@')
    expect(patch).toContain('-before')
    expect(patch).toContain('+after')
    expect(countPatch(patch)).toEqual({ additions: 1, deletions: 1 })
  })

  it('treats a binary patch as binary', () => {
    expect(isBinaryPatch('Binary files a and b differ')).toBe(true)
    expect(isBinaryPatch('GIT binary patch\nliteral 0')).toBe(true)
  })

  it('keeps a content line that mentions binary files', () => {
    const text = `@@ -1 +1,2 @@
 kept
+Binary files a and b differ
`
    expect(isBinaryPatch(text)).toBe(false)
    expect(countPatch(text).additions).toBe(1)
  })
})
