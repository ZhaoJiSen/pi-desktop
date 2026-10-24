import { type ReactNode } from 'react'
import { fileNameOf } from '../../lib/source/paths'
import type { NavigableFile } from './GitFileList'

export function MatchedText({ file, field }: { file: NavigableFile; field: 'name' | 'path' }) {
  const text = field === 'name' ? fileNameOf(file.path) : file.path
  const ranges = file.searchMatches?.find((match) => match.key === field)?.indices ?? []
  const pieces: ReactNode[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) pieces.push(text.slice(cursor, start))
    pieces.push(<mark key={`${start}-${end}`}>{text.slice(start, end + 1)}</mark>)
    cursor = end + 1
  }
  pieces.push(text.slice(cursor))
  return <>{pieces}</>
}
