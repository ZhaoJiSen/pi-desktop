import type { DiffLine } from '../../types'

export type DiffKind = 'add' | 'remove' | 'context' | 'hunk'

export interface DiffRow {
  kind: DiffKind
  text: string
  oldLine?: number
  newLine?: number
}

export interface ParsedDiff {
  rows: DiffRow[]
  additions: number
  deletions: number
  binary: boolean
}

export interface SplitCell {
  kind: 'add' | 'remove' | 'context' | 'empty'
  text: string
  line?: number
}

export type SplitRow =
  | { kind: 'hunk'; text: string }
  | { kind: 'pair'; left: SplitCell; right: SplitCell }

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function parseUnifiedDiff(text: string): ParsedDiff {
  if (text.includes('Binary files ') || text.includes('GIT binary patch')) {
    return { rows: [], additions: 0, deletions: 0, binary: true }
  }
  const rows: DiffRow[] = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false
  let additions = 0
  let deletions = 0
  for (const line of text.split('\n')) {
    if (
      line.startsWith('diff --git ') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('new file ') ||
      line.startsWith('deleted file ') ||
      line.startsWith('similarity ') ||
      line.startsWith('rename ') ||
      line.startsWith('old mode ') ||
      line.startsWith('new mode ') ||
      line.startsWith('\\')
    ) {
      continue
    }
    const hunk = HUNK.exec(line)
    if (hunk) {
      inHunk = true
      oldLine = Number(hunk[1])
      newLine = Number(hunk[2])
      rows.push({ kind: 'hunk', text: line })
      continue
    }
    if (!inHunk || line === '') continue
    if (line.startsWith('+')) {
      rows.push({ kind: 'add', text: line.slice(1), newLine })
      newLine += 1
      additions += 1
    } else if (line.startsWith('-')) {
      rows.push({ kind: 'remove', text: line.slice(1), oldLine })
      oldLine += 1
      deletions += 1
    } else {
      const text = line.startsWith(' ') ? line.slice(1) : line
      rows.push({ kind: 'context', text, oldLine, newLine })
      oldLine += 1
      newLine += 1
    }
  }
  return { rows, additions, deletions, binary: false }
}

export function fromToolDiff(lines: DiffLine[]): ParsedDiff {
  let additions = 0
  let deletions = 0
  const rows = lines.map((line) => {
    if (line.kind === 'add') additions += 1
    if (line.kind === 'remove') deletions += 1
    return {
      kind: line.kind,
      text: line.text,
      oldLine: line.kind === 'add' ? undefined : line.number,
      newLine: line.kind === 'remove' ? undefined : line.number,
    }
  })
  return { rows, additions, deletions, binary: false }
}

const emptyCell: SplitCell = { kind: 'empty', text: '' }

export function toSplitRows(rows: DiffRow[]): SplitRow[] {
  const split: SplitRow[] = []
  let index = 0
  while (index < rows.length) {
    const row = rows[index]
    if (!row) break
    if (row.kind === 'hunk') {
      split.push({ kind: 'hunk', text: row.text })
      index += 1
      continue
    }
    if (row.kind === 'context') {
      split.push({
        kind: 'pair',
        left: { kind: 'context', text: row.text, line: row.oldLine },
        right: { kind: 'context', text: row.text, line: row.newLine },
      })
      index += 1
      continue
    }
    const removes: DiffRow[] = []
    const adds: DiffRow[] = []
    while (rows[index]?.kind === 'remove') removes.push(rows[index++]!)
    while (rows[index]?.kind === 'add') adds.push(rows[index++]!)
    const count = Math.max(removes.length, adds.length)
    for (let pair = 0; pair < count; pair += 1) {
      const removed = removes[pair]
      const added = adds[pair]
      split.push({
        kind: 'pair',
        left: removed ? { kind: 'remove', text: removed.text, line: removed.oldLine } : emptyCell,
        right: added ? { kind: 'add', text: added.text, line: added.newLine } : emptyCell,
      })
    }
  }
  return split
}
