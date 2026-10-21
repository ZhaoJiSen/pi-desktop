import { describe, expect, it } from 'vitest'
import { fromToolDiff, parseUnifiedDiff, toSplitRows } from '../../src/lib/source/diff'

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
  it('counts added and removed lines and keeps hunk context', () => {
    const parsed = parseUnifiedDiff(unified)
    expect(parsed.binary).toBe(false)
    expect(parsed.additions).toBe(1)
    expect(parsed.deletions).toBe(0)
    expect(parsed.rows.some((row) => row.kind === 'hunk')).toBe(true)
    expect(parsed.rows.find((row) => row.kind === 'add')).toMatchObject({
      text: '  { id: "gpt-5", provider: "openai" },',
      newLine: 3,
    })
  })

  it('pairs a removed line with the added line beside it', () => {
    const parsed = parseUnifiedDiff(`@@ -1,2 +1,2 @@
-old
+new
 same
`)
    const split = toSplitRows(parsed.rows)
    expect(split[1]).toMatchObject({
      kind: 'pair',
      left: { kind: 'remove', text: 'old' },
      right: { kind: 'add', text: 'new' },
    })
  })

  it('keeps tool diffs that are not unified hunks', () => {
    const parsed = fromToolDiff([
      { kind: 'remove', text: 'before', number: 4 },
      { kind: 'add', text: 'after', number: 4 },
    ])
    expect(parsed.deletions).toBe(1)
    expect(parsed.additions).toBe(1)
    expect(parsed.rows[0]).toMatchObject({ oldLine: 4, newLine: undefined })
  })

  it('treats a binary patch as binary', () => {
    expect(parseUnifiedDiff('Binary files a and b differ').binary).toBe(true)
  })
})
