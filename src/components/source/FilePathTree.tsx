import { useMemo, useState } from 'react'
import { Tree, type Key } from 'react-aria-components'
import { useT } from '../../lib/i18n'
import { buildPathTree, type PathTreeNode } from '../../lib/source/fileTree'
import { pathTouched } from '../../lib/source/paths'
import type { CommitFile, GitFileStatus } from '../../lib/source/types'
import { SourceTreeItem } from './SourceTreeItem'

export function FilePathTree({
  files,
  selected,
  agent = new Set(),
  onSelect,
  revealKey = 0,
}: {
  files: (CommitFile | GitFileStatus)[]
  selected: string | null
  revealKey?: number
  agent?: Set<string>
  onSelect: (path: string) => void
}) {
  const t = useT()
  const tree = useMemo(() => buildPathTree(files.map((file) => file.path)), [files])
  const statuses = new Map(files.map((file) => [file.path, file]))
  // Remember explicitly collapsed paths while new changes arrive.
  const [collapsed, setCollapsed] = useState<Set<Key>>(new Set())
  const [revealed, setRevealed] = useState({ selected, revealKey })
  if (revealed.selected !== selected || revealed.revealKey !== revealKey) {
    setRevealed({ selected, revealKey })
    if (selected)
      setCollapsed(
        (current) => new Set([...current].filter((path) => !selected.startsWith(`${path}/`))),
      )
  }
  const expanded = tree.branches.filter((path) => !collapsed.has(path))
  const render = (node: PathTreeNode) => {
    const file = statuses.get(node.path)
    return (
      <SourceTreeItem
        key={node.path}
        path={node.path}
        name={node.name}
        kind={node.kind}
        selected={selected === node.path}
        code={file?.code}
        agent={pathTouched(agent, node.path)}
        onAction={() => {
          if (node.kind === 'file') onSelect(node.path)
          else
            setCollapsed((current) => {
              const next = new Set(current)
              if (expanded.includes(node.path)) next.add(node.path)
              else next.delete(node.path)
              return next
            })
        }}
      >
        {node.children.map(render)}
      </SourceTreeItem>
    )
  }
  return (
    <Tree
      aria-label={t('source.changedFiles')}
      className="source-tree"
      expandedKeys={expanded}
      onExpandedChange={(keys) =>
        setCollapsed(new Set(tree.branches.filter((path) => !keys.has(path))))
      }
    >
      {tree.nodes.map(render)}
    </Tree>
  )
}
