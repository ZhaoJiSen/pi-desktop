import { fileLanguage, Highlight } from '../conversation/Highlight'
import type { DiffRow, SplitCell } from '../../lib/source/diff'
import { toSplitRows } from '../../lib/source/diff'

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
    <div className={`code-line ${kind === 'empty' ? 'context is-empty' : kind}`}>
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
  return (
    <div className="code" tabIndex={0}>
      {rows.map((row, index) =>
        row.kind === 'hunk' ? (
          <div className="code-line hunk" key={index}>
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
        ),
      )}
    </div>
  )
}

function SplitCellView({ cell, language }: { cell: SplitCell; language: string }) {
  return <DiffLine kind={cell.kind} line={cell.line} text={cell.text} language={language} />
}

export function SplitRows({ rows, path }: { rows: DiffRow[]; path: string }) {
  const language = fileLanguage(path)
  return (
    <div className="split-diff">
      {toSplitRows(rows).map((row, index) =>
        row.kind === 'hunk' ? (
          <div className="split-hunk" key={index}>
            {row.text}
          </div>
        ) : (
          <div className="split-pair" key={index}>
            <SplitCellView cell={row.left} language={language} />
            <SplitCellView cell={row.right} language={language} />
          </div>
        ),
      )}
    </div>
  )
}
