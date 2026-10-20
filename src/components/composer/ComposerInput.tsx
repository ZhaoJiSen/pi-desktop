import { TextArea } from '@heroui/react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { DraftNode } from '../../types'
import { filterCommands, type DiscoverableCommand } from '../../lib/commands'
import { createCommandTag, draftFromText, draftText, slashQuery } from '../../lib/draft'
import { useT } from '../../lib/i18n'
import { SlashCommandMenu } from './SlashCommandMenu'

export function ComposerInput({
  value,
  commands,
  loading,
  catalogError,
  onChange,
  onSubmit,
  inputRef,
  anchorRef,
  placement,
  boundaryElement,
  focusVersion,
  onSelectCapability,
}: {
  value: DraftNode[]
  commands: DiscoverableCommand[]
  loading: boolean
  catalogError: string
  onChange: (value: DraftNode[]) => void
  onSubmit: () => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  anchorRef: RefObject<HTMLElement | null>
  placement: 'top start' | 'bottom start'
  boundaryElement?: Element
  focusVersion: number
  onSelectCapability?: (id: string) => Promise<boolean>
}) {
  const t = useT()
  const text = draftText(value)
  const listId = useId()
  const measure = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const pendingCaret = useRef<number | null>(null)
  const [query, setQuery] = useState<ReturnType<typeof slashQuery>>(null)
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const rows = query ? filterCommands(commands, query.query, 'all') : []
  const activeIndex = Math.min(index, Math.max(0, rows.length - 1))

  const resize = useCallback(() => {
    const input = inputRef.current,
      mirror = measure.current
    const shell = input?.closest<HTMLElement>('.composer-shell')
    if (!input || !mirror || !shell) return
    const style = getComputedStyle(shell)
    const inputStyle = getComputedStyle(input)
    const lineHeight = parseFloat(inputStyle.lineHeight) || 22
    const minHeight = Math.ceil(Math.max(parseFloat(inputStyle.minHeight) || 0, lineHeight))
    const maxHeight = parseFloat(inputStyle.maxHeight) || 176
    const width = shell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const toolbar = shell.querySelector<HTMLElement>('.composer-toolbar')
    const compactWidth = width - (toolbar?.offsetWidth ?? 0) - 34 - 16
    mirror.style.width = `${Math.max(1, compactWidth)}px`
    const multiline =
      Boolean(shell.querySelector('.attachments')) ||
      input.value.includes('\n') ||
      compactWidth < 120 ||
      (Boolean(input.value) && mirror.scrollHeight > minHeight)
    setNarrow((multiline ? width : compactWidth) < 320)
    if (multiline) mirror.style.width = `${width}px`
    const height = Math.min(maxHeight, Math.max(minHeight, mirror.scrollHeight))
    if (input.style.height !== `${height}px`) input.style.height = `${height}px`
    input.style.overflowY = mirror.scrollHeight > Math.ceil(maxHeight) ? 'auto' : 'hidden'
    setExpanded(multiline)
  }, [inputRef])
  useLayoutEffect(resize, [resize, text])
  useEffect(() => {
    const shell = inputRef.current?.closest<HTMLElement>('.composer-shell')
    if (!shell) return
    const observer = new ResizeObserver(resize)
    observer.observe(shell)
    const toolbar = shell.querySelector('.composer-toolbar')
    if (toolbar) observer.observe(toolbar)
    // The mirror itself stays zero-height. Its child still lays out naturally,
    // so font/line-height changes trigger a resize even when the toolbar keeps
    // the outer shell at the same height.
    const content = measure.current?.firstElementChild
    if (content) observer.observe(content)
    return () => observer.disconnect()
  }, [inputRef, resize])
  useLayoutEffect(() => {
    const input = inputRef.current
    if (pendingCaret.current === null || !input) return
    input.focus({ preventScroll: true })
    input.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  }, [inputRef, text])
  useEffect(() => {
    const input = inputRef.current
    input?.focus({ preventScroll: true })
    input?.setSelectionRange(input.value.length, input.value.length)
    // Setting a textarea selection does not reveal it when restoring a draft.
    // Only explicit focus-at-end actions scroll; native typing owns scrolling.
    if (input) input.scrollTop = input.scrollHeight
  }, [inputRef, focusVersion])
  function detect(input: HTMLTextAreaElement) {
    setQuery(
      input.selectionStart === input.selectionEnd
        ? slashQuery([{ type: 'text', text: input.value }], input.selectionStart)
        : null,
    )
    setIndex(0)
  }
  async function choose(command: DiscoverableCommand) {
    if (!query) return
    if (command.capabilityId && onSelectCapability) {
      const range = query
      setQuery(null)
      if (!(await onSelectCapability(command.capabilityId))) return
      // Do not overwrite text typed while a mode acknowledgement was pending.
      if (inputRef.current?.value !== text) return
      const next = text.slice(0, range.start) + text.slice(range.end)
      pendingCaret.current = range.start
      onChange(draftFromText(next, commands))
      inputRef.current?.focus()
      return
    }
    const inserted = `/${command.name} `
    const next = text.slice(0, query.start) + inserted + text.slice(query.end)
    pendingCaret.current = query.start + inserted.length
    onChange(draftFromText(next, commands, [createCommandTag(command)]))
    setQuery(null)
  }
  return (
    <div className="composer-input-wrap">
      <div ref={measure} className="composer-input-measure" aria-hidden="true">
        <div>{text + '\u200b'}</div>
      </div>
      <TextArea
        ref={inputRef}
        className="composer-input"
        data-expanded={expanded || undefined}
        rows={1}
        value={text}
        aria-label={t('composer.placeholder')}
        placeholder={t(narrow ? 'composer.shortPlaceholder' : 'composer.placeholder')}
        aria-autocomplete="list"
        aria-controls={query ? listId : undefined}
        aria-expanded={Boolean(query)}
        aria-activedescendant={query && rows.length ? `${listId}-${activeIndex}` : undefined}
        onChange={(event) => {
          onChange(draftFromText(event.target.value, commands, value))
          if (!composing.current) detect(event.target)
        }}
        onSelect={(event) => {
          if (!composing.current) detect(event.currentTarget)
        }}
        onBlur={() => setQuery(null)}
        onCompositionStart={() => {
          composing.current = true
          setQuery(null)
        }}
        onCompositionEnd={(event) => {
          composing.current = false
          detect(event.currentTarget)
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return
          if (query && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
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
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            if (!event.metaKey && !event.ctrlKey) {
              setQuery(null)
              onSubmit()
            }
          }
        }}
      />
      <SlashCommandMenu
        anchorRef={anchorRef}
        placement={placement}
        boundaryElement={boundaryElement}
        open={Boolean(query)}
        onClose={() => setQuery(null)}
        listId={listId}
        rows={rows}
        activeIndex={activeIndex}
        loading={loading}
        catalogError={catalogError}
        onHighlight={setIndex}
        onChoose={choose}
      />
    </div>
  )
}
