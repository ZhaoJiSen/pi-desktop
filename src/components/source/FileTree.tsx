import { useState } from 'react'
import { Tree, TreeItem, TreeItemContent, type Key } from 'react-aria-components'
import { useT } from '../../lib/i18n'
import { listProjectDirectory } from '../../lib/source/api'
import { pathTouched } from '../../lib/source/paths'
import type { DirectoryEntry, DirectoryListing } from '../../lib/source/types'
import { SourceTreeItem } from './SourceTreeItem'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'

interface FileTreeProps {
  projectPath: string
  tick: number
  expand?: string | null
  selected?: string | null
  marks: Map<string, string>
  agent: Set<string>
  onOpen: (path: string) => void
}

function ancestors(path: string | null | undefined) {
  const parts = path?.split('/').filter(Boolean) ?? []
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'))
}

export function FileTree(props: FileTreeProps) {
  const t = useT()
  const { projectPath, tick, expand } = props
  const [expanded, setExpanded] = useState<Set<Key>>(() => new Set(ancestors(expand)))
  const [trackedExpand, setTrackedExpand] = useState(expand)
  if (trackedExpand !== expand) {
    setTrackedExpand(expand)
    setExpanded((current) => new Set([...current, ...ancestors(expand)]))
  }
  const listing = useSourceQuery(
    `dir:${projectPath}:`,
    () => listProjectDirectory(projectPath),
    tick,
  )
  if (listing.loading) return <SourceNotice kind="loading" text={t('source.loading')} />
  if (listing.error || !listing.data) {
    return <SourceNotice kind="error" text={listing.error || t('source.emptyDirectory')} />
  }
  if (!listing.data.entries.length) {
    return <SourceNotice kind="empty" text={t('source.emptyDirectory')} />
  }
  return (
    <>
      <Tree
        aria-label={t('source.files')}
        className="source-tree"
        expandedKeys={expanded}
        onExpandedChange={setExpanded}
      >
        {listing.data.entries.map((entry) => (
          <TreeEntry
            key={entry.path}
            {...props}
            entry={entry}
            expanded={expanded}
            onExpand={setExpanded}
          />
        ))}
      </Tree>
      <DirectoryNotes listing={listing.data} />
    </>
  )
}

function TreeEntry({
  entry,
  expanded,
  onExpand,
  ...props
}: FileTreeProps & {
  entry: DirectoryEntry
  expanded: Set<Key>
  onExpand: (keys: Set<Key>) => void
}) {
  const t = useT()
  const isDirectory = entry.kind === 'dir'
  const isOpen = expanded.has(entry.path)
  const listing = useSourceQuery(
    isDirectory && isOpen ? `dir:${props.projectPath}:${entry.path}` : null,
    () => listProjectDirectory(props.projectPath, entry.path),
    props.tick,
  )
  const code = props.marks.get(entry.path)
  const touched = pathTouched(props.agent, entry.path)
  const toggle = () => {
    const keys = new Set(expanded)
    if (isOpen) keys.delete(entry.path)
    else keys.add(entry.path)
    onExpand(keys)
  }
  return (
    <SourceTreeItem
      path={entry.path}
      name={entry.name}
      kind={entry.kind}
      selected={props.selected === entry.path}
      loading={listing.loading}
      code={code}
      agent={touched}
      onAction={isDirectory ? toggle : () => props.onOpen(entry.path)}
    >
      {/* Keep a child node before loading so arrow keys can expand lazy directories. */}
      {isDirectory && (!isOpen || listing.loading) && (
        <TreeItem id={`\0loading:${entry.path}`} textValue={t('source.loading')} isDisabled>
          <TreeItemContent>
            <p className="source-note">{t('source.loading')}</p>
          </TreeItemContent>
        </TreeItem>
      )}
      {isOpen &&
        listing.data?.entries.map((child) => (
          <TreeEntry
            key={child.path}
            {...props}
            entry={child}
            expanded={expanded}
            onExpand={onExpand}
          />
        ))}
      {isOpen &&
        !listing.loading &&
        (listing.error ||
          (listing.data &&
            (!listing.data.entries.length ||
              listing.data.truncated ||
              listing.data.ignorePartial))) && (
          <TreeItem
            id={`\0notice:${entry.path}`}
            textValue={listing.error || t('source.emptyDirectory')}
            isDisabled
            className="source-tree-notice"
          >
            <TreeItemContent>
              {listing.error ? (
                <p className="source-note">{listing.error}</p>
              ) : (
                listing.data &&
                (listing.data.entries.length ? (
                  <DirectoryNotes listing={listing.data} />
                ) : (
                  <p className="source-note">{t('source.emptyDirectory')}</p>
                ))
              )}
            </TreeItemContent>
          </TreeItem>
        )}
    </SourceTreeItem>
  )
}

function DirectoryNotes({ listing }: { listing: DirectoryListing }) {
  const t = useT()
  return (
    <>
      {listing.truncated && <p className="source-note">{t('source.truncatedList')}</p>}
      {listing.ignorePartial && <p className="source-note">{t('source.ignorePartial')}</p>}
    </>
  )
}
