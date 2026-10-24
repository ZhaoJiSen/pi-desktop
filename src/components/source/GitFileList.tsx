import { ListBox } from '@heroui/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Fuse, { type FuseResultMatch } from 'fuse.js'
import { useEffect, useMemo, useRef } from 'react'
import { fileNameOf } from '../../lib/source/paths'
import type { CommitFile, GitFileStatus } from '../../lib/source/types'
import { OverflowTooltip } from '../OverflowTooltip'
import { FileTreeIcon } from './FileTreeIcon'
import { MatchedText } from './GitMatchedText'

export type NavigableFile = (CommitFile | GitFileStatus) & {
  searchMatches?: readonly FuseResultMatch[]
}

export function useFileSearch(files: NavigableFile[], query: string) {
  const index = useMemo(
    () =>
      new Fuse(
        files.map((file) => ({ ...file, name: fileNameOf(file.path) })),
        {
          keys: [
            { name: 'name', weight: 0.7 },
            { name: 'path', weight: 0.3 },
          ],
          threshold: 0.35,
          ignoreLocation: true,
          includeMatches: true,
        },
      ),
    [files],
  )
  return useMemo(
    () =>
      query.trim()
        ? index
            .search(query.trim())
            .map((result) => ({ ...result.item, searchMatches: result.matches }))
        : files,
    [files, index, query],
  )
}

export function GitFileList({
  files,
  selected,
  onSelect,
  label,
}: {
  files: NavigableFile[]
  selected: string | null
  onSelect: (path: string) => void
  label: string
}) {
  const parent = useRef<HTMLDivElement>(null)
  // oxlint-disable-next-line react/incompatible-library -- TanStack owns mutable measurements; do not memoize the virtualizer.
  const virtual = useVirtualizer({
    count: files.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 48,
    gap: 4,
    overscan: 8,
  })
  const selectedIndex = files.findIndex((file) => file.path === selected)
  useEffect(() => {
    if (selectedIndex >= 0) virtual.scrollToIndex(selectedIndex, { align: 'auto' })
    else if (files.length) virtual.scrollToIndex(0, { align: 'start' })
  }, [files, selectedIndex, virtual])
  return (
    <div
      className="git-file-list"
      ref={parent}
      onKeyDownCapture={(event) => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || !files.length) return
        event.preventDefault()
        event.stopPropagation()
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? files.length - 1
              : Math.max(
                  0,
                  Math.min(files.length - 1, selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)),
                )
        onSelect(files[index]!.path)
        virtual.scrollToIndex(index, { align: 'auto' })
        requestAnimationFrame(() =>
          parent.current?.querySelector<HTMLElement>(`[data-file-index="${index}"]`)?.focus(),
        )
      }}
    >
      <ListBox
        aria-label={label}
        selectionMode="single"
        selectedKeys={selected ? [selected] : []}
        onAction={(key) => onSelect(String(key))}
        className="git-file-options"
        style={{ height: virtual.getTotalSize() }}
      >
        {virtual.getVirtualItems().map((row) => {
          const file = files[row.index]!
          return (
            <ListBox.Item
              key={file.path}
              id={file.path}
              data-file-index={row.index}
              textValue={file.path}
              className="git-file-option"
              style={{ position: 'absolute', top: row.start, height: row.size, width: '100%' }}
            >
              <FileTreeIcon name={fileNameOf(file.path)} kind="file" expanded={false} />
              <span className="git-file-label">
                <OverflowTooltip text={fileNameOf(file.path)} tooltip={file.path}>
                  <MatchedText file={file} field="name" />
                </OverflowTooltip>
                <OverflowTooltip as="small" text={file.path}>
                  <MatchedText file={file} field="path" />
                </OverflowTooltip>
              </span>
              <span className="source-code" data-code={file.code}>
                {file.code}
              </span>
            </ListBox.Item>
          )
        })}
      </ListBox>
    </div>
  )
}
