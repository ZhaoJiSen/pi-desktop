import { useEffect, useState, type MouseEvent, type RefObject } from 'react'

type Point = { row: number; offset: number; side: string }

function selectionPoint(node: Node, offset: number, root: HTMLElement): Point | null {
  const element = node instanceof Element ? node : node.parentElement
  const row = element?.closest<HTMLElement>('[data-row]')
  const code = row?.querySelector('[data-code]')
  const side = row?.closest<HTMLElement>('[data-side]')?.dataset.side
  if (!row || !code || !side || !root.contains(row)) return null
  let column = 0
  if (code.contains(node)) {
    const range = document.createRange()
    range.selectNodeContents(code)
    range.setEnd(node, offset)
    column = range.toString().length
  } else {
    // Triple-clicks and whole-row ranges can end at an ancestor's child offset.
    const selected = document.createRange()
    selected.selectNodeContents(row)
    selected.setEnd(node, offset)
    const prefix = document.createRange()
    prefix.selectNodeContents(row)
    prefix.setEnd(code, 0)
    column = Math.max(
      0,
      Math.min(
        code.textContent?.length ?? 0,
        selected.toString().length - prefix.toString().length,
      ),
    )
  }
  return { row: Number(row.dataset.row), offset: column, side }
}

/** Keep native selection endpoints mounted and copy intervening virtual rows from data. */
export function useDiffSelection(
  ref: RefObject<HTMLDivElement | null>,
  textAt: (row: number, side: string) => string | undefined,
) {
  const [pinned, setPinned] = useState<number[]>([])
  const [selectionSide, setSelectionSide] = useState<string>()
  useEffect(() => {
    const update = () => {
      const selection = window.getSelection()
      const root = ref.current
      const points =
        root && selection && !selection.isCollapsed
          ? [selection.anchorNode, selection.focusNode].flatMap((node) => {
              const element = node instanceof Element ? node : node?.parentElement
              const row = element?.closest<HTMLElement>('[data-row]')
              return row && root.contains(row) ? [Number(row.dataset.row)] : []
            })
          : []
      setPinned((current) => (current.join(',') === points.join(',') ? current : points))
    }
    const copy = (event: ClipboardEvent) => {
      // Shortcuts on non-editable code usually target body, outside this root.
      if (event.defaultPrevented || !event.clipboardData) return
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')
      )
        return
      const selection = window.getSelection()
      const root = ref.current
      if (!root || !selection?.rangeCount || selection.isCollapsed) return
      const range = selection.getRangeAt(0)
      const start = selectionPoint(range.startContainer, range.startOffset, root)
      const end = selectionPoint(range.endContainer, range.endOffset, root)
      if (!start || !end || start.side !== end.side) return
      const lines: string[] = []
      for (let row = start.row; row <= end.row; row++) {
        const line = textAt(row, start.side)
        if (line === undefined) continue
        lines.push(
          line.slice(
            row === start.row ? start.offset : 0,
            row === end.row ? end.offset : undefined,
          ),
        )
      }
      event.clipboardData.setData('text/plain', lines.join('\n'))
      event.preventDefault()
    }
    document.addEventListener('selectionchange', update)
    document.addEventListener('copy', copy)
    return () => {
      document.removeEventListener('selectionchange', update)
      document.removeEventListener('copy', copy)
    }
  }, [ref, textAt])
  const onMouseDown = (event: MouseEvent) => {
    const side = (event.target as Element).closest<HTMLElement>('[data-side]')?.dataset.side
    if (event.button !== 0 || !side) return
    if (selectionSide !== side) window.getSelection()?.removeAllRanges()
    setSelectionSide(side)
  }
  return { pinned, onMouseDown, selectionSide }
}
