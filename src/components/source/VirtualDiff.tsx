import {
  DiffFile,
  DiffLineType,
  getPlainDiffTemplate,
  getPlainLineTemplate,
  getSplitContentLines,
  getSyntaxDiffTemplate,
  getSyntaxLineTemplate,
  getUnifiedContentLine,
  type DiffLine,
  type DiffViewProps,
} from '@git-diff-view/react'
import { memo, useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useDiffWindow } from './useDiffWindow'
import { useDiffSelection } from './useDiffSelection'

type Side = 'old' | 'new'
type Cell = { number?: number; text: string; diff?: DiffLine; side: Side }
type Row = { old?: Cell; new?: Cell }
type Data = NonNullable<DiffViewProps<unknown>['data']>

function createModel(data: Data) {
  const file = new DiffFile(
    data.oldFile?.fileName ?? '',
    '',
    data.newFile?.fileName ?? '',
    '',
    data.hunks,
    data.oldFile?.fileLang ?? '',
    data.newFile?.fileLang ?? '',
  )
  file.initRaw()
  file.buildSplitDiffLines()
  file.buildUnifiedDiffLines()
  file.initSyntax()
  const unified: Row[] = getUnifiedContentLine(file).map(({ unifiedLine: line }) => {
    const side = line.newLineNumber === undefined ? 'old' : 'new'
    return {
      [side]: {
        number: line.newLineNumber ?? line.oldLineNumber,
        text: line.value ?? '',
        diff: line.diff,
        side,
      },
    }
  })
  const split: Row[] = getSplitContentLines(file).map(({ splitLine: { left, right } }) => ({
    old: { number: left.lineNumber, text: left.value ?? '', diff: left.diff, side: 'old' },
    new: { number: right.lineNumber, text: right.value ?? '', diff: right.diff, side: 'new' },
  }))
  const width = (side: Side) =>
    split.reduce((max, row) => Math.max(max, row[side]?.text.length ?? 0), 0)
  return { file, unified, split, oldWidth: width('old'), newWidth: width('new') }
}

function cellHTML(file: DiffFile, cell: Cell) {
  const { number, text, diff, side } = cell
  const syntax =
    number === undefined
      ? undefined
      : side === 'old'
        ? file.getOldSyntaxLine(number)
        : file.getNewSyntaxLine(number)
  const operator = diff?.type === DiffLineType.Add ? 'add' : 'del'
  if (syntax && syntax.nodeList.length <= 150) {
    if (diff?.changes?.hasLineChange) {
      getSyntaxDiffTemplate({ diffFile: file, diffLine: diff, syntaxLine: syntax, operator })
      if (diff.syntaxTemplate) return diff.syntaxTemplate
    }
    return syntax.template ?? getSyntaxLineTemplate(syntax)
  }
  if (diff?.changes?.hasLineChange) {
    getPlainDiffTemplate({ diffLine: diff, rawLine: text, operator })
    if (diff.plainTemplate) return diff.plainTemplate
  }
  return getPlainLineTemplate(text)
}

const VirtualCell = memo(function VirtualCell({
  cell,
  file,
  index,
  height,
}: {
  cell?: Cell
  file: DiffFile
  index: number
  height: number
}) {
  const state =
    cell?.diff?.type === DiffLineType.Add
      ? 'add'
      : cell?.diff?.type === DiffLineType.Delete
        ? 'del'
        : cell?.number === undefined
          ? 'empty'
          : 'plain'
  const html = useMemo(() => (cell ? cellHTML(file, cell) : ''), [cell, file])
  return (
    <div
      className="source-diff-vrow"
      data-state={state}
      data-row={index}
      role="row"
      aria-rowindex={index + 1}
      style={{ top: index * height, height }}
    >
      <span className="source-diff-vnum" role="rowheader">
        {cell?.number}
      </span>
      <div className="diff-line-content-item" role="cell">
        <span className="diff-line-content-operator">
          {state === 'add' ? '+' : state === 'del' ? '−' : ' '}
        </span>
        <span
          className="diff-line-syntax-raw"
          data-code
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {cell?.diff?.noTrailingNewLine && (
          <span className="source-diff-no-newline" title="No newline at end of file">
            ↵
          </span>
        )}
      </div>
    </div>
  )
})

/** Only mounted for larger patches; small diffs keep the existing renderer. */
export function VirtualDiff({
  data,
  layout,
  mode,
  codeSize,
}: {
  data: Data
  layout: 'unified' | 'split'
  mode: 'light' | 'dark'
  codeSize: number
}) {
  const model = useMemo(() => createModel(data), [data])
  // _destroy releases the library's id registration without invalidating the
  // parsed model during React StrictMode's effect replay.
  useEffect(() => () => model.file._destroy(), [model])
  const rows = layout === 'split' ? model.split : model.unified
  const height = Math.max(28, codeSize * 1.6)
  const anchor = useMemo(() => {
    const keys = new Map<string, number>()
    rows.forEach((row, index) => {
      if (row.old?.number !== undefined) keys.set(`old:${row.old.number}`, index)
      if (row.new?.number !== undefined) keys.set(`new:${row.new.number}`, index)
    })
    return {
      content: model,
      layout,
      at: (index: number) => {
        const row = rows[index]
        const cell = row?.new?.number !== undefined ? row.new : row?.old
        return cell?.number === undefined ? undefined : `${cell.side}:${cell.number}`
      },
      find: (key: string) => keys.get(key),
    }
  }, [layout, model, rows])
  const { ref, start, end } = useDiffWindow(rows.length, height, anchor)
  const left = useRef<HTMLDivElement>(null)
  const right = useRef<HTMLDivElement>(null)
  const syncedScroll = useRef(new WeakMap<HTMLDivElement, number>())
  const textAt = useCallback(
    (index: number, side: string) => {
      const row = rows[index]
      const text =
        side === 'unified'
          ? (row?.new ?? row?.old)?.text
          : row?.[side as Side]?.number === undefined
            ? undefined
            : row[side as Side]?.text
      return text?.replace(/\r?\n$/, '')
    },
    [rows],
  )
  const { pinned, onMouseDown, selectionSide } = useDiffSelection(ref, textAt)
  const visible = [
    ...new Set([
      ...Array.from({ length: Math.max(0, end - start) }, (_, offset) => start + offset),
      ...pinned.filter((index) => index < rows.length),
    ]),
  ].sort((a, b) => a - b)
  const sides: Side[] = layout === 'split' ? ['old', 'new'] : ['new']
  return (
    <div className="diff-tailwindcss-wrapper" data-component="git-diff-view" data-theme={mode}>
      <div
        className="diff-style-root"
        style={{ '--diff-font-size--': `${codeSize}px` } as CSSProperties}
      >
        <div
          className={`diff-view-wrapper source-virtual-diff ${layout === 'split' ? 'split-diff-view-normal' : ''}`}
          id={`diff-root${model.file.getId()}`}
          ref={ref}
          onMouseDown={onMouseDown}
          data-selection-side={selectionSide}
          data-total-rows={rows.length}
          style={{ height: rows.length * height, fontSize: codeSize, lineHeight: `${height}px` }}
        >
          {sides.map((side, sideIndex) => (
            <div
              key={side}
              className="source-diff-vside"
              data-side={layout === 'unified' ? 'unified' : side}
              role="table"
              aria-label={`${data.newFile?.fileName ?? ''}${layout === 'split' ? ` (${side})` : ''}`}
              aria-rowcount={rows.length}
              aria-colcount={2}
              ref={sideIndex === 0 ? left : right}
              onScroll={(event) => {
                const element = event.currentTarget
                const expected = syncedScroll.current.get(element)
                syncedScroll.current.delete(element)
                // Ignore the feedback event, including values clamped by a shorter column.
                if (expected !== undefined && element.scrollLeft === expected) return
                const other = sideIndex === 0 ? right.current : left.current
                if (!other || other === element) return
                const next = Math.max(
                  0,
                  Math.min(element.scrollLeft, other.scrollWidth - other.clientWidth),
                )
                if (other.scrollLeft !== next) {
                  other.scrollLeft = next
                  syncedScroll.current.set(other, other.scrollLeft)
                }
              }}
            >
              <div
                className="source-diff-vcontent"
                style={{
                  height: rows.length * height,
                  minWidth: `max(100%, calc(${layout === 'unified' ? Math.max(model.oldWidth, model.newWidth) : side === 'old' ? model.oldWidth : model.newWidth}ch + 3.2em + 24px))`,
                }}
              >
                {visible.map((index) => (
                  <VirtualCell
                    key={index}
                    file={model.file}
                    cell={
                      layout === 'unified'
                        ? (rows[index].new ?? rows[index].old)
                        : rows[index][side]
                    }
                    index={index}
                    height={height}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
