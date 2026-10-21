import { Button } from '@heroui/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { listProjectDirectory } from '../../lib/source/api'
import type { DirectoryEntry } from '../../lib/source/types'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'

export function FileTree({
  projectPath,
  tick,
  marks,
  agent,
  onOpen,
}: {
  projectPath: string
  tick: number
  marks: Map<string, string>
  agent: Set<string>
  onOpen: (path: string) => void
}) {
  return (
    <div className="source-tree" role="tree">
      <TreeDir
        projectPath={projectPath}
        tick={tick}
        relative=""
        depth={0}
        marks={marks}
        agent={agent}
        onOpen={onOpen}
      />
    </div>
  )
}

function TreeDir({
  projectPath,
  tick,
  relative,
  depth,
  marks,
  agent,
  onOpen,
}: {
  projectPath: string
  tick: number
  relative: string
  depth: number
  marks: Map<string, string>
  agent: Set<string>
  onOpen: (path: string) => void
}) {
  const t = useT()
  const listing = useSourceQuery(`dir:${projectPath}:${relative}:${tick}`, () =>
    listProjectDirectory(projectPath, relative),
  )
  if (listing.loading) {
    return depth === 0 ? <SourceNotice kind="loading" text={t('source.loading')} /> : null
  }
  if (listing.error || !listing.data) {
    return depth === 0 ? (
      <SourceNotice kind="error" text={listing.error || t('source.emptyDirectory')} />
    ) : null
  }
  if (depth === 0 && listing.data.entries.length === 0) {
    return <SourceNotice kind="empty" text={t('source.emptyDirectory')} />
  }
  return (
    <div role="group">
      {listing.data.entries.map((entry) =>
        entry.kind === 'dir' ? (
          <TreeBranch
            key={entry.path}
            entry={entry}
            depth={depth}
            projectPath={projectPath}
            tick={tick}
            marks={marks}
            agent={agent}
            onOpen={onOpen}
          />
        ) : entry.kind === 'link' ? (
          <TreeLink key={entry.path} entry={entry} depth={depth} />
        ) : (
          <TreeFile
            key={entry.path}
            entry={entry}
            depth={depth}
            code={marks.get(entry.path)}
            agent={agent.has(entry.path)}
            onOpen={onOpen}
          />
        ),
      )}
      {listing.data.truncated && <p className="source-note">{t('source.truncatedList')}</p>}
    </div>
  )
}

function TreeBranch({
  entry,
  depth,
  projectPath,
  tick,
  marks,
  agent,
  onOpen,
}: {
  entry: DirectoryEntry
  depth: number
  projectPath: string
  tick: number
  marks: Map<string, string>
  agent: Set<string>
  onOpen: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <Button
        variant="ghost"
        className="source-row"
        style={{ paddingLeft: 12 + depth * 14 }}
        aria-expanded={open}
        onPress={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown /> : <ChevronRight />}
        <span className="source-name">{entry.name}</span>
      </Button>
      {open && (
        <TreeDir
          projectPath={projectPath}
          tick={tick}
          relative={entry.path}
          depth={depth + 1}
          marks={marks}
          agent={agent}
          onOpen={onOpen}
        />
      )}
    </div>
  )
}

function TreeLink({ entry, depth }: { entry: DirectoryEntry; depth: number }) {
  return (
    <div className="source-link" style={{ paddingLeft: 28 + depth * 14 }} role="treeitem">
      <span className="source-name" title={entry.path}>
        {entry.name}
      </span>
    </div>
  )
}

function TreeFile({
  entry,
  depth,
  code,
  agent,
  onOpen,
}: {
  entry: DirectoryEntry
  depth: number
  code?: string
  agent: boolean
  onOpen: (path: string) => void
}) {
  const t = useT()
  return (
    <Button
      variant="ghost"
      className="source-row"
      style={{ paddingLeft: 28 + depth * 14 }}
      onPress={() => onOpen(entry.path)}
    >
      <span className="source-name" title={entry.path}>
        {entry.name}
      </span>
      {code && (
        <span className="source-code" data-code={code}>
          {code}
        </span>
      )}
      {agent && <span className="source-agent">{t('source.agent')}</span>}
    </Button>
  )
}
