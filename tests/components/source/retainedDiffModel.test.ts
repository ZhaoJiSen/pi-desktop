// @vitest-environment happy-dom
import { DiffFile, getUnifiedContentLine } from '@git-diff-view/react'
import { expect, it } from 'vitest'
import { retainDiffModel } from '../../../src/components/source/retainDiffModel'

it('preserves parsed rows through production cleanup and Activity resumption', () => {
  const file = new DiffFile('a.ts', '', 'a.ts', '', [
    'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new\n',
  ])
  file.initRaw()
  file.buildUnifiedDiffLines()
  file.buildSplitDiffLines()
  const before = getUnifiedContentLine(file).map(({ unifiedLine }) => unifiedLine.value)
  expect(before.join('\n')).toContain('new')
  const destroy = file.clear
  retainDiffModel({ getDiffFileInstance: () => file })
  for (let resume = 0; resume < 3; resume++) {
    file.clear()
    file.initRaw()
    file.buildUnifiedDiffLines()
    file.buildSplitDiffLines()
    expect(getUnifiedContentLine(file).map(({ unifiedLine }) => unifiedLine.value)).toEqual(before)
    expect(file.getUnifiedLine(file.unifiedLineLength - 1)).toBeDefined()
  }
  destroy()
})
it('accepts React clearing a ref or a viewer without a model', () => {
  expect(() => retainDiffModel(null)).not.toThrow()
  expect(() => retainDiffModel({ getDiffFileInstance: () => null })).not.toThrow()
})
