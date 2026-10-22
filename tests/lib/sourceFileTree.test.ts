import { describe, expect, it } from 'vitest'
import { buildPathTree } from '../../src/lib/source/fileTree'

describe('Git path tree', () => {
  it('groups only supplied changed paths and sorts folders before files', () => {
    const tree = buildPathTree(['readme.md', 'src/z.ts', 'src/components/button.tsx', 'src/a.ts'])
    expect(tree.nodes.map((node) => node.name)).toEqual(['src', 'readme.md'])
    expect(tree.nodes[0]?.children.map((node) => node.name)).toEqual(['components', 'a.ts', 'z.ts'])
    expect(tree.branches).toEqual(['src', 'src/components'])
  })
  it('keeps Unicode and spaces intact and deduplicates repeated paths', () => {
    const tree = buildPathTree(['文档/release notes.md', '文档/release notes.md'])
    expect(tree.nodes[0]?.children).toEqual([
      { name: 'release notes.md', path: '文档/release notes.md', kind: 'file', children: [] },
    ])
    expect(tree.branches).toEqual(['文档'])
  })
})
