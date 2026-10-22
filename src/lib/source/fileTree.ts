export interface PathTreeNode {
  path: string
  name: string
  kind: 'dir' | 'file'
  children: PathTreeNode[]
}

/** Build only the supplied paths: Git trees must never read the full filesystem. */
export function buildPathTree(paths: string[]) {
  const root: PathTreeNode = { path: '', name: '', kind: 'dir', children: [] }
  const nodes = new Map<string, PathTreeNode>([['', root]])
  for (const path of paths) {
    const parts = path.split('/').filter(Boolean)
    for (let index = 0; index < parts.length; index++) {
      const key = parts.slice(0, index + 1).join('/')
      if (nodes.has(key)) continue
      const node: PathTreeNode = {
        path: key,
        name: parts[index]!,
        kind: index < parts.length - 1 ? 'dir' : 'file',
        children: [],
      }
      nodes.set(key, node)
      nodes.get(parts.slice(0, index).join('/'))!.children.push(node)
    }
  }
  const sort = (node: PathTreeNode) => {
    node.children.sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1,
    )
    node.children.forEach(sort)
  }
  sort(root)
  return {
    nodes: root.children,
    branches: [...nodes.values()]
      .filter((node) => node.path && node.kind === 'dir')
      .map((node) => node.path),
  }
}
