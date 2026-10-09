import type { HTMLAttributes } from 'react'
import type { CommandTag } from '../../types'
import { decodeDraft, DRAFT_MIME, draftText, replaceDraft, sliceDraft } from '../../lib/draft'
import { editorSelection, readEditor, selectEditor } from './editorDom'
import type { DraftEditorController } from './useDraftEditor'

type EventController = Pick<
  DraftEditorController,
  | 'editor'
  | 'latest'
  | 'selection'
  | 'composing'
  | 'query'
  | 'rows'
  | 'activeIndex'
  | 'selected'
  | 'setFocused'
  | 'setQuery'
  | 'setIndex'
  | 'setSelected'
  | 'detect'
  | 'commit'
  | 'insert'
  | 'moveHistory'
  | 'removeAdjacent'
  | 'editTag'
  | 'choose'
>

export function createDraftEditorHandlers(
  controller: EventController,
  disabled: boolean,
  onSubmit: () => void,
): HTMLAttributes<HTMLDivElement> {
  const {
    editor,
    latest,
    selection,
    composing,
    query,
    rows,
    activeIndex,
    selected,
    setFocused,
    setQuery,
    setIndex,
    setSelected,
    detect,
    commit,
    insert,
    moveHistory,
    removeAdjacent,
    editTag,
    choose,
  } = controller
  return {
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false)
      setQuery(null)
    },
    onCompositionStart: () => {
      composing.current = true
      setQuery(null)
    },
    onBeforeInput: (event) => {
      const type = (event.nativeEvent as InputEvent).inputType
      if (composing.current || disabled) return
      if (type === 'historyUndo' || type === 'historyRedo') {
        event.preventDefault()
        moveHistory(type === 'historyUndo' ? -1 : 1)
      } else if (type === 'deleteContentBackward' || type === 'deleteContentForward') {
        if (removeAdjacent(type === 'deleteContentBackward')) event.preventDefault()
      }
    },
    onCompositionEnd: () => {
      composing.current = false
      const root = editor.current!
      commit(
        readEditor(
          root,
          latest.current.filter((n): n is CommandTag => n.type === 'command'),
        ),
        editorSelection(root) || selection.current,
      )
    },
    onInput: () => {
      if (composing.current) return
      const root = editor.current!
      const nodes = readEditor(
        root,
        latest.current.filter((n): n is CommandTag => n.type === 'command'),
      )
      const cursor = editorSelection(root) || selection.current
      commit(nodes, cursor)
    },
    onKeyUp: (event) => {
      if (
        ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) &&
        !composing.current &&
        editor.current
      ) {
        const cursor = editorSelection(editor.current)
        if (cursor) detect(latest.current, cursor)
      }
    },
    onClick: (event) => {
      const atom = (event.target as Element).closest<HTMLElement>('[data-command-id]')
      if (!atom) {
        setSelected(null)
        if (editor.current)
          detect(latest.current, editorSelection(editor.current) || selection.current)
        return
      }
      setSelected(atom.dataset.commandId!)
      const range = document.createRange()
      range.selectNode(atom)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
      selection.current = editorSelection(editor.current!) || selection.current
      setQuery(null)
    },
    onDoubleClick: (event) => {
      const id = (event.target as Element).closest<HTMLElement>('[data-command-id]')?.dataset
        .commandId
      const item = latest.current.find((n): n is CommandTag => n.type === 'command' && n.id === id)
      if (item) {
        editTag(item.id)
        setQuery(null)
      }
    },
    onCopy: (event) => {
      const cursor = editorSelection(editor.current!)
      if (!cursor || cursor.start === cursor.end) return
      const nodes = sliceDraft(latest.current, cursor.start, cursor.end)
      event.preventDefault()
      event.clipboardData.setData('text/plain', draftText(nodes))
      event.clipboardData.setData(DRAFT_MIME, JSON.stringify({ version: 1, nodes }))
    },
    onCut: (event) => {
      const cursor = editorSelection(editor.current!)
      if (!cursor || cursor.start === cursor.end || disabled) return
      const nodes = sliceDraft(latest.current, cursor.start, cursor.end)
      event.preventDefault()
      event.clipboardData.setData('text/plain', draftText(nodes))
      event.clipboardData.setData(DRAFT_MIME, JSON.stringify({ version: 1, nodes }))
      commit(replaceDraft(latest.current, cursor.start, cursor.end, []), {
        start: cursor.start,
        end: cursor.start,
      })
    },
    onPaste: (event) => {
      event.preventDefault()
      if (disabled) return
      const structured = decodeDraft(event.clipboardData.getData(DRAFT_MIME))
      insert(
        structured || [
          {
            type: 'text',
            text: event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n'),
          },
        ],
      )
    },
    onKeyDown: (event) => {
      if (event.nativeEvent.isComposing || composing.current) return
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
        event.preventDefault()
        moveHistory(event.shiftKey || event.key.toLowerCase() === 'y' ? 1 : -1)
        return
      }
      if (query && !modifier) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setQuery(null)
          return
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setIndex(
            (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + Math.max(rows.length, 1)) %
              Math.max(rows.length, 1),
          )
          return
        }
        if (event.key === 'Enter' && rows[activeIndex]) {
          event.preventDefault()
          choose(rows[activeIndex]!)
          return
        }
      }
      if (modifier && event.key === 'Enter') {
        event.preventDefault()
        setQuery(null)
        onSubmit()
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (removeAdjacent(event.key === 'Backspace')) event.preventDefault()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        insert([{ type: 'text', text: '\n' }])
        return
      }
      if (
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        !modifier &&
        !event.shiftKey
      ) {
        const cursor = editorSelection(editor.current!) || selection.current
        const backward = event.key === 'ArrowLeft'
        const start = backward ? cursor.start - 1 : cursor.end
        if (
          cursor.start !== cursor.end ||
          sliceDraft(latest.current, start, start + 1)[0]?.type === 'command'
        ) {
          event.preventDefault()
          const position =
            cursor.start !== cursor.end
              ? backward
                ? cursor.start
                : cursor.end
              : backward
                ? start
                : start + 1
          selection.current = { start: position, end: position }
          selectEditor(editor.current!, selection.current)
          setSelected(null)
          setQuery(null)
        }
      }
      if (selected && event.key === 'F2') {
        const item = latest.current.find(
          (n): n is CommandTag => n.type === 'command' && n.id === selected,
        )
        if (item) {
          event.preventDefault()
          editTag(item.id)
        }
      }
    },
  }
}
