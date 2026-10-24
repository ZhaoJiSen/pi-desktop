import { describe, expect, it } from 'vitest'
import { connectVisible, layoutGraph } from '../../src/lib/source/graph'

describe('commit graph', () => {
  it('keeps a straight history in one lane', () => {
    const rows = layoutGraph([
      { hash: 'c', parents: ['b'] },
      { hash: 'b', parents: ['a'] },
      { hash: 'a', parents: [] },
    ])
    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0])
  })

  it('draws a merge into a second lane and curves it back', () => {
    const rows = layoutGraph([
      { hash: 'c', parents: ['b', 'd'] },
      { hash: 'b', parents: ['a'] },
      { hash: 'd', parents: ['a'] },
      { hash: 'a', parents: [] },
    ])
    expect(rows[0]?.lane).toBe(0)
    expect(rows[0]?.links).toContainEqual({ from: 0, to: 1 })
    expect(rows[2]?.lane).toBe(1)
    expect(rows[2]?.links).toContainEqual({ from: 1, to: 0 })
    expect(rows[3]?.lane).toBe(0)
  })

  it('reconnects a filtered history through the nearest visible parent', () => {
    const commits = [
      { hash: 'c', parents: ['b'] },
      { hash: 'b', parents: ['a'] },
      { hash: 'a', parents: [] },
    ]
    const visible = connectVisible(commits, new Set(['c', 'a']))
    expect(visible.map((commit) => commit.hash)).toEqual(['c', 'a'])
    expect(visible[0]?.parents).toEqual(['a'])
  })

  it('handles a 100,000-commit gap without recursive stack overflow', () => {
    const commits = Array.from({ length: 100_000 }, (_, index) => ({
      hash: String(index),
      parents: index < 99_999 ? [String(index + 1)] : [],
    }))
    const visible = connectVisible(commits, new Set(['0', '99999']))
    expect(visible).toEqual([
      { hash: '0', parents: ['99999'] },
      { hash: '99999', parents: [] },
    ])
    const rows = layoutGraph(commits)
    expect(rows).toHaveLength(100_000)
    expect(rows[99_999]?.output).toEqual([])
    expect(rows.every((row) => row.lane === 0 && row.columns === 1)).toBe(true)
  })

  it('preserves parent order and removes duplicates through hidden merges and cycles', () => {
    const commits = [
      { hash: 'head', parents: ['hidden-left', 'hidden-right', 'missing'] },
      { hash: 'hidden-left', parents: ['left', 'hidden-right'] },
      { hash: 'hidden-right', parents: ['right', 'hidden-left'] },
      { hash: 'left', parents: [] },
      { hash: 'right', parents: [] },
    ]
    expect(connectVisible(commits, new Set(['head', 'left', 'right']))[0]?.parents).toEqual([
      'left',
      'right',
    ])
  })
})
