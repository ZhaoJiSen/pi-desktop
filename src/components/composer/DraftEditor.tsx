import type { RefObject } from 'react'
import { isDraftEmpty } from '../../lib/draft'
import { useT } from '../../lib/i18n'
import { CommandTagActions } from './CommandTagActions'
import { createDraftEditorHandlers } from './draftEditorEvents'
import { SlashCommandMenu } from './SlashCommandMenu'
import { useDraftEditor, type DraftEditorProps } from './useDraftEditor'

export function DraftEditor(
  props: DraftEditorProps & {
    menuAnchorRef?: RefObject<HTMLElement | null>
    menuPlacement?: 'top start' | 'bottom start'
    menuBoundary?: Element
  },
) {
  const t = useT()
  const controller = useDraftEditor(props)
  const {
    editor,
    query,
    focused,
    listId,
    rows,
    activeIndex,
    setIndex,
    setQuery,
    choose,
    selected,
    editing,
    tag,
    args,
    setArgs,
    editTag,
    removeTag,
    saveArguments,
    cancelEditing,
  } = controller
  const handlers = createDraftEditorHandlers(controller, props.disabled ?? false, props.onSubmit)
  const suggestionsOpen = Boolean(query && focused && !props.disabled)
  const placeholder = t('composer.placeholder')
  const showPlaceholder = isDraftEmpty(props.value)
  return (
    <div className="draft-editor-wrap">
      <div className="draft-field">
        <div
          ref={editor}
          className="draft-editor"
          contentEditable={!props.disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-disabled={props.disabled || undefined}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-controls={suggestionsOpen ? listId : undefined}
          aria-expanded={suggestionsOpen}
          aria-activedescendant={
            suggestionsOpen && rows.length ? `${listId}-${activeIndex}` : undefined
          }
          data-placeholder={placeholder}
          {...handlers}
        />
        {showPlaceholder && (
          <span className="draft-placeholder" aria-hidden="true">
            {placeholder}
          </span>
        )}
      </div>
      <SlashCommandMenu
        anchorRef={props.menuAnchorRef ?? editor}
        placement={props.menuPlacement ?? 'bottom start'}
        boundaryElement={props.menuBoundary}
        open={suggestionsOpen}
        onClose={() => setQuery(null)}
        listId={listId}
        rows={rows}
        activeIndex={activeIndex}
        loading={props.loading}
        catalogError={props.catalogError}
        onHighlight={setIndex}
        onChoose={choose}
      />
      <CommandTagActions
        selected={props.disabled ? null : selected}
        editing={props.disabled ? null : editing}
        tag={props.disabled ? undefined : tag}
        args={args}
        setArgs={setArgs}
        editTag={editTag}
        removeTag={removeTag}
        saveArguments={saveArguments}
        cancelEditing={cancelEditing}
      />
    </div>
  )
}
