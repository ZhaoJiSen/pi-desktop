import { Popover } from '@heroui/react'
import type { RefObject } from 'react'
import type { DiscoverableCommand } from '../../lib/commands'
import { useT } from '../../lib/i18n'

export function SlashCommandMenu({
  anchorRef,
  placement,
  boundaryElement,
  open,
  onClose,
  listId,
  rows,
  activeIndex,
  loading,
  catalogError,
  onHighlight,
  onChoose,
}: {
  anchorRef: RefObject<HTMLElement | null>
  placement: 'top start' | 'bottom start'
  boundaryElement?: Element
  open: boolean
  onClose: () => void
  listId: string
  rows: DiscoverableCommand[]
  activeIndex: number
  loading: boolean
  catalogError: string
  onHighlight: (index: number) => void
  onChoose: (command: DiscoverableCommand) => void
}) {
  const t = useT()
  return (
    <Popover.Content
      className="slash-panel"
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
      triggerRef={anchorRef}
      placement={placement}
      shouldFlip
      containerPadding={24}
      boundaryElement={boundaryElement}
      offset={8}
      crossOffset={12}
      isNonModal
    >
      <div className="slash-panel-heading">
        <span>{t('navigation.commands')}</span>
        <span>{t('composer.commandKeys')}</span>
      </div>
      <div
        role="listbox"
        id={listId}
        aria-label={t('navigation.commands')}
        className="slash-options"
      >
        {rows.map((command, i) => (
          <div
            key={`${command.source}:${command.name}:${command.sourceInfo?.source || command.sourceInfo?.path || ''}`}
            role="option"
            id={`${listId}-${i}`}
            aria-selected={activeIndex === i}
            className={`slash-option ${activeIndex === i ? 'active' : ''}`}
            onPointerDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHighlight(i)}
            onClick={() => onChoose(command)}
          >
            <span className="slash-option-copy">
              <strong>/{command.name}</strong>
              <span>{command.description || t('commands.noDescription')}</span>
            </span>
            <span className="slash-option-source">
              {command.capabilityId && command.source === 'builtin'
                ? command.sourceInfo?.source
                : t(`commands.source.${command.source}`)}
            </span>
          </div>
        ))}
        {!rows.length && (
          <p className="slash-empty" role="status">
            {loading ? t('commands.loading') : catalogError || t('commands.empty')}
          </p>
        )}
      </div>
      {rows.length > 0 && catalogError && (
        <p className="slash-empty" role="status">
          {catalogError}
        </p>
      )}
    </Popover.Content>
  )
}
