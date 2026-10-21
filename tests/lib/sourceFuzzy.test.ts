import { describe, expect, it } from 'vitest'
import { fuzzyFilter, fuzzyScore } from '../../src/lib/source/fuzzy'

describe('quick open matching', () => {
  it('scores a filename match above a longer path', () => {
    const paths = fuzzyFilter('mod', [
      'docs/model-notes/readme.md',
      'src/components/model-selector.tsx',
      'src/styles/_conversation.scss',
    ])
    expect(paths[0]).toBe('src/components/model-selector.tsx')
    expect(paths).not.toContain('src/styles/_conversation.scss')
  })

  it('returns every path when the query is empty', () => {
    expect(fuzzyScore('', 'src/models.ts')).toBe(1)
    expect(fuzzyFilter('', ['b.ts', 'a.ts'])).toEqual(['a.ts', 'b.ts'])
  })
})
