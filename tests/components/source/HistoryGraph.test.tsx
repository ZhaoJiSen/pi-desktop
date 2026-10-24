// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HistoryGraph } from '../../../src/components/source/HistoryGraph'
import { layoutGraph, type GraphRow } from '../../../src/lib/source/graph'

function renderGraph(row: GraphRow, height: number) {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(<HistoryGraph row={row} height={height} />)
  return container.querySelector('svg')!
}

describe.each([28, 34])('HistoryGraph at %ipx', (height) => {
  it('starts a new merge lane at the curve, without a vertical spur', () => {
    const rows = layoutGraph([
      { hash: 'merge', parents: ['main', 'feature'] },
      { hash: 'main', parents: ['root'] },
    ])
    const merge = renderGraph(rows[0]!, height)
    // Only the first parent continues straight down from the commit.
    expect(merge.querySelectorAll('line')).toHaveLength(1)
    expect(merge.querySelector('line')?.getAttribute('x1')).toBe('8')
    expect(merge.querySelector('path')?.getAttribute('d')).toMatch(new RegExp(`, 22 ${height}$`))
    // The curve meets the next row at exactly its upper boundary.
    const nextLane = renderGraph(rows[1]!, height).querySelector('line[x1="22"]')
    expect(nextLane?.getAttribute('y1')).toBe('0')
    expect(nextLane?.getAttribute('y2')).toBe(String(height))
  })

  it('keeps an existing target lane uninterrupted when another branch joins it', () => {
    const rows = layoutGraph([
      { hash: 'merge', parents: ['main', 'feature'] },
      { hash: 'feature', parents: ['main'] },
    ])
    const join = renderGraph(rows[1]!, height)
    expect(join.querySelectorAll('line[x1="8"]')).toHaveLength(1)
    const main = join.querySelector('line[x1="8"]')
    expect(main?.getAttribute('y1')).toBe('0')
    expect(main?.getAttribute('y2')).toBe(String(height))
    // The feature lane ends at its commit; its parent is reached by the curve.
    expect(join.querySelector('line[x1="22"]')?.getAttribute('y2')).toBe(String(height / 2))
    expect(join.querySelectorAll('path')).toHaveLength(1)
  })

  it('does not add vertical spurs to any parent of an octopus merge', () => {
    const [row] = layoutGraph([{ hash: 'merge', parents: ['main', 'one', 'two'] }])
    const graph = renderGraph(row!, height)
    expect(graph.querySelectorAll('path')).toHaveLength(2)
    expect(graph.querySelectorAll('line')).toHaveLength(1)
    expect(graph.querySelector('line')?.getAttribute('x1')).toBe('8')
  })

  it('preserves straight histories and terminates a root at its commit', () => {
    const rows = layoutGraph([
      { hash: 'head', parents: ['middle'] },
      { hash: 'middle', parents: ['root'] },
      { hash: 'root', parents: [] },
    ])
    const root = renderGraph(rows[2]!, height)
    expect(root.querySelector('line')?.getAttribute('y2')).toBe(String(height / 2))
    const middle = renderGraph(rows[1]!, height)
    const segments = Array.from(middle.querySelectorAll('line'))
    expect(segments.map((line) => [line.getAttribute('y1'), line.getAttribute('y2')])).toEqual([
      ['0', String(height / 2)],
      [String(height / 2), String(height)],
    ])
    expect(middle.querySelectorAll('path')).toHaveLength(0)
  })
})
