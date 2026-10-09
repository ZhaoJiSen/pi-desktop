import { Button } from '@heroui/react'
import { motion } from 'motion/react'
import { useT } from '../../lib/i18n'
import type { DraftEditorController } from './useDraftEditor'

type Props = Pick<
  DraftEditorController,
  | 'selected'
  | 'editing'
  | 'tag'
  | 'args'
  | 'setArgs'
  | 'editTag'
  | 'removeTag'
  | 'saveArguments'
  | 'cancelEditing'
>

export function CommandTagActions({
  selected,
  editing,
  tag,
  args,
  setArgs,
  editTag,
  removeTag,
  saveArguments,
  cancelEditing,
}: Props) {
  const t = useT()
  return (
    <>
      {selected && !editing && (
        <div className="command-selection-actions">
          <Button variant="ghost" onPress={() => editTag(selected)}>
            {t('composer.editCommand')}
          </Button>
          <Button variant="ghost" onPress={() => removeTag(selected)}>
            {t('composer.removeCommand')}
          </Button>
        </div>
      )}
      {tag && (
        <motion.div
          className="command-edit"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
        >
          <label>
            <span>
              /{tag.name} · {t('composer.commandArguments')}
            </span>
            <input
              autoFocus
              value={args}
              aria-label={t('composer.commandArguments')}
              onChange={(e) => setArgs(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEditing()
                }
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  e.currentTarget
                    .closest('.command-edit')
                    ?.querySelector<HTMLButtonElement>('[data-save]')
                    ?.click()
                }
              }}
            />
          </label>
          <Button data-save variant="secondary" onPress={saveArguments}>
            {t('common.save')}
          </Button>
          <Button variant="ghost" onPress={cancelEditing}>
            {t('common.cancel')}
          </Button>
        </motion.div>
      )}
    </>
  )
}
