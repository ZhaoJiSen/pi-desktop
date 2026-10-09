import { AnimatePresence, motion } from 'motion/react'
import type { DiscoverableCommand } from '../../lib/commands'
import { useT } from '../../lib/i18n'

export function SlashCommandMenu({
  open,
  listId,
  rows,
  activeIndex,
  loading,
  catalogError,
  onHighlight,
  onChoose,
}: {
  open: boolean
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
    <AnimatePresence>
      {open && (
        <motion.div
          className="slash-panel"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
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
                  {t(`commands.source.${command.source}`)}
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
