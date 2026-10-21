import { describe, expect, it } from 'vitest'
import { findLineHits } from '../../src/lib/source/find'

describe('findLineHits', () => {
  const lines = ['export const Ready = false', 'const ready = true', '']

  it('returns nothing for a blank query', () => {
    expect(findLineHits(lines, '')).toEqual([])
    expect(findLineHits(lines, '   ')).toEqual([])
  })

  it('matches lines without case and skips misses', () => {
    expect(findLineHits(lines, 'READY')).toEqual([0, 1])
    expect(findLineHits(lines, 'missing')).toEqual([])
  })
})
