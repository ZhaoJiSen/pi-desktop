import { describe, expect, it } from 'vitest'
import { buildPathTree, orderFilesByTree } from '../../src/lib/source/fileTree'

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
  it('orders diff files by tree traversal rather than flat path order, preserving file data', () => {
    const files = [
      { path: 'src/App.vue', additions: 1 },
      { path: 'src/settings.js', additions: 3 },
      { path: 'src/store/modules/table.js', additions: 2 },
    ]
    const ordered = orderFilesByTree(files)
    expect(ordered.map((file) => file.path)).toEqual([
      'src/store/modules/table.js',
      'src/App.vue',
      'src/settings.js',
    ])
    expect(ordered[0]).toBe(files[2])
    expect(files[0]?.path).toBe('src/App.vue')
  })
})
