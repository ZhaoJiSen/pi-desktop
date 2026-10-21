import { fileLanguage, Highlight } from '../conversation/Highlight'
import type { DiffRow, SplitCell } from '../../lib/source/diff'
import { toSplitRows } from '../../lib/source/diff'
import { codeRowHeight, useVirtualWindow } from './useVirtualWindow'

function DiffLine({
  kind,
  line,
  text,
  language,
}: {
  kind: 'add' | 'remove' | 'context' | 'empty'
  line?: number
  text: string
  language: string
}) {
  return (
    <div
      className={`code-line source-vrow ${kind === 'empty' ? 'context is-empty' : kind}`}
      style={{ height: codeRowHeight }}
    >
      <span className="line-no">{line ?? ''}</span>
      <code className="source">
        <span className="change">{kind === 'add' ? '+' : kind === 'remove' ? '−' : ' '}</span>
        {kind === 'empty' ? null : <Highlight text={text} language={language} />}
      </code>
    </div>
  )
}

export function UnifiedRows({ rows, path }: { rows: DiffRow[]; path: string }) {
  const language = fileLanguage(path)
  const { scroller, start, end, paddingTop, paddingBottom } = useVirtualWindow(
    rows.length,
    codeRowHeight,
  )
  const slice = rows.slice(start, end)
  return (
    <div className="code" tabIndex={0} ref={scroller}>
      <div className="source-vpad" style={{ height: paddingTop }} />
      {slice.map((row, offset) => {
        const index = start + offset
        return row.kind === 'hunk' ? (
          <div className="code-line hunk source-vrow" style={{ height: codeRowHeight }} key={index}>
            <code className="source hunk-text">{row.text}</code>
          </div>
        ) : (
          <DiffLine
            key={index}
            kind={row.kind}
            line={row.kind === 'remove' ? row.oldLine : row.newLine}
            text={row.text}
            language={language}
          />
        )
      })}
      <div className="source-vpad" style={{ height: paddingBottom }} />
    </div>
  )
}

function SplitCellView({ cell, language }: { cell: SplitCell; language: string }) {
  return <DiffLine kind={cell.kind} line={cell.line} text={cell.text} language={language} />
}

export function SplitRows({ rows, path }: { rows: DiffRow[]; path: string }) {
  const language = fileLanguage(path)
  const split = toSplitRows(rows)
  const { scroller, start, end, paddingTop, paddingBottom } = useVirtualWindow(
    split.length,
    codeRowHeight,
  )
  return (
    <div className="split-diff" ref={scroller}>
      <div className="source-vpad" style={{ height: paddingTop }} />
      {split.slice(start, end).map((row, offset) => {
        const index = start + offset
        return row.kind === 'hunk' ? (
          <div className="split-hunk source-vrow" style={{ height: codeRowHeight }} key={index}>
            {row.text}
          </div>
        ) : (
          <div className="split-pair source-vrow" style={{ height: codeRowHeight }} key={index}>
            <SplitCellView cell={row.left} language={language} />
            <SplitCellView cell={row.right} language={language} />
          </div>
        )
      })}
      <div className="source-vpad" style={{ height: paddingBottom }} />
    </div>
  )
}
