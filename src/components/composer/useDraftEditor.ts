import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CommandTag, DraftNode } from '../../types'
import type { DiscoverableCommand } from '../../lib/commands'
import { filterCommands } from '../../lib/commands'
import {
  commandAvailable,
  createCommandTag,
  draftLength,
  normalizeDraft,
  replaceDraft,
  slashQuery,
  sliceDraft,
} from '../../lib/draft'
import { useT } from '../../lib/i18n'
import { editorSelection, renderEditor, selectEditor, type EditorSelection } from './editorDom'

interface Snapshot {
  nodes: DraftNode[]
  selection: EditorSelection
}
export interface DraftEditorProps {
  value: DraftNode[]
  commands: DiscoverableCommand[]
  loading: boolean
  catalogError: string
  onChange: (nodes: DraftNode[]) => void
  onSubmit: () => void
  disabled?: boolean
}

export function useDraftEditor({
  value,
  commands,
  loading,
  onChange,
  disabled = false,
}: DraftEditorProps) {
  const t = useT()
  const listId = useId()
  const editor = useRef<HTMLDivElement>(null)
  const latest = useRef(value)
  const initialCursor = { start: draftLength(value), end: draftLength(value) }
  const selection = useRef<EditorSelection>(initialCursor)
  const history = useRef<Snapshot[]>([{ nodes: value, selection: initialCursor }])
  const historyIndex = useRef(0)
  const composing = useRef(false)
  const [query, setQuery] = useState<ReturnType<typeof slashQuery>>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [args, setArgs] = useState('')
  const [focused, setFocused] = useState(false)
  const rows = query ? filterCommands(commands, query.query, 'all') : []
  const activeIndex = Math.min(index, Math.max(0, rows.length - 1))
  const tag = value.find(
    (node): node is CommandTag => node.type === 'command' && node.id === editing,
  )
  const paint = useCallback(
    (nodes: DraftNode[], cursor?: EditorSelection) => {
      if (!editor.current) return
      const unavailable = (node: CommandTag) => !loading && !commandAvailable(node, commands)
      const label = (node: CommandTag) =>
        unavailable(node) ? t('composer.commandUnavailable') : t(`commands.source.${node.source}`)
      renderEditor(editor.current, nodes, label, unavailable)
      editor.current.dataset.empty = String(!nodes.length)
      if (cursor) selectEditor(editor.current, cursor)
    },
    [commands, loading, t],
  )
  useLayoutEffect(() => {
    if (composing.current) return
    const changed = JSON.stringify(latest.current) !== JSON.stringify(value)
    const current = editor.current ? editorSelection(editor.current) : null
    latest.current = value
    paint(value, current ?? undefined)
    if (changed) {
      history.current = [{ nodes: value, selection: selection.current }]
      historyIndex.current = 0
      setQuery(null)
      setSelected(null)
      setEditing(null)
    }
  }, [value, paint])
  useEffect(() => {
    editor.current?.focus()
    if (editor.current) selectEditor(editor.current, selection.current)
  }, [])
  useEffect(() => {
    function changed() {
      if (!editor.current) return
      const cursor = editorSelection(editor.current)
      if (cursor) selection.current = cursor
    }
    document.addEventListener('selectionchange', changed)
    return () => document.removeEventListener('selectionchange', changed)
  }, [])
  useEffect(() => {
    editor.current
      ?.querySelectorAll('[data-command-id]')
      .forEach((node) =>
        node.classList.toggle('selected', node.getAttribute('data-command-id') === selected),
      )
  }, [selected, value, paint])
  useEffect(() => {
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listId, query?.query])
  function detect(nodes: DraftNode[], cursor: EditorSelection) {
    const next =
      cursor.start === cursor.end && !composing.current ? slashQuery(nodes, cursor.start) : null
    setQuery(next)
    setIndex(0)
  }
  function commit(nodes: DraftNode[], cursor: EditorSelection, record = true, suggest = true) {
    const normalized = normalizeDraft(nodes)
    if (record && JSON.stringify(normalized) !== JSON.stringify(latest.current)) {
      history.current[historyIndex.current]!.selection = selection.current
      history.current = history.current.slice(0, historyIndex.current + 1)
      history.current.push({ nodes: normalized, selection: cursor })
      if (history.current.length > 100) history.current.shift()
      historyIndex.current = history.current.length - 1
    }
    latest.current = normalized
    selection.current = cursor
    paint(normalized, cursor)
    onChange(normalized)
    setSelected(null)
    if (suggest) detect(normalized, cursor)
    else setQuery(null)
  }
  function insert(nodes: DraftNode[], suggest = true) {
    const cursor = (editor.current && editorSelection(editor.current)) || selection.current
    const end = cursor.start + draftLength(nodes)
    commit(
      replaceDraft(latest.current, cursor.start, cursor.end, nodes),
      { start: end, end },
      true,
      suggest,
    )
  }
  function choose(command: DiscoverableCommand) {
    if (!query || disabled) return
    const end = query.start + 2
    editor.current?.focus()
    commit(
      replaceDraft(latest.current, query.start, query.end, [
        createCommandTag(command),
        { type: 'text', text: ' ' },
      ]),
      { start: end, end },
      true,
      false,
    )
  }
  function moveHistory(direction: number) {
    const next = historyIndex.current + direction
    const snapshot = history.current[next]
    if (!snapshot) return
    historyIndex.current = next
    commit(snapshot.nodes, snapshot.selection, false, false)
    setEditing(null)
  }
  function removeTag(id: string) {
    let offset = 0
    for (const node of latest.current) {
      if (node.type === 'command' && node.id === id) {
        editor.current?.focus()
        commit(
          replaceDraft(latest.current, offset, offset + 1, []),
          { start: offset, end: offset },
          true,
          false,
        )
        setEditing(null)
        return
      }
      offset += node.type === 'text' ? node.text.length : 1
    }
  }
  function removeAdjacent(backward: boolean) {
    const cursor = (editor.current && editorSelection(editor.current)) || selection.current
    if (cursor.start !== cursor.end) {
      commit(replaceDraft(latest.current, cursor.start, cursor.end, []), {
        start: cursor.start,
        end: cursor.start,
      })
      return true
    }
    const start = backward ? cursor.start - 1 : cursor.start
    if (sliceDraft(latest.current, start, start + 1)[0]?.type !== 'command') return false
    commit(replaceDraft(latest.current, start, start + 1, []), { start, end: start }, true, false)
    return true
  }

  function editTag(id: string) {
    const item = latest.current.find(
      (node): node is CommandTag => node.type === 'command' && node.id === id,
    )
    if (item) {
      setEditing(item.id)
      setArgs(item.arguments)
    }
  }
  function cancelEditing() {
    setEditing(null)
    editor.current?.focus()
  }
  function saveArguments() {
    if (!tag) return
    editor.current?.focus()
    commit(
      latest.current.map((node) =>
        node.type === 'command' && node.id === tag.id ? { ...node, arguments: args } : node,
      ),
      selection.current,
      true,
      false,
    )
    setEditing(null)
  }

  return {
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
    listId,
    focused,
    tag,
    args,
    editing,
    setArgs,
    choose,
    removeTag,
    cancelEditing,
    saveArguments,
  }
}
export type DraftEditorController = ReturnType<typeof useDraftEditor>
