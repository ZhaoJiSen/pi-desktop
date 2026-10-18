import { isPlanCapability } from '../../lib/capabilities/catalog'
import { Button, Popover, Tag, TagGroup } from '@heroui/react'
import { motion, useReducedMotion } from 'motion/react'
import { LockKeyhole } from 'lucide-react'
import type { Capability, CapabilitySelection } from '../../lib/capabilities/types'
import { useT } from '../../lib/i18n'
import { CapabilityIcon } from './CapabilityIcon'
import { CapabilityDetails } from './CapabilityDetails'

export function CapabilityTags({
  selection,
  disabled,
  onRemove,
  onArguments,
}: {
  selection: CapabilitySelection
  disabled: boolean
  onRemove: (capability: Capability) => void
  onArguments: (value: string) => void
}) {
  const t = useT(),
    reduced = useReducedMotion()
  const items = [selection.mode, selection.task].filter((c): c is Capability => Boolean(c))
  if (!items.length) return null
  return (
    <TagGroup
      className="capability-tags"
      aria-label={t('capability.selected')}
      size="sm"
      onRemove={
        disabled ? undefined : (keys) => items.filter((item) => keys.has(item.id)).forEach(onRemove)
      }
    >
      <TagGroup.List items={items} dependencies={[disabled, t, onArguments]}>
        {(item) => (
          <Tag
            isDisabled={disabled}
            id={item.id}
            textValue={item.name}
            className="capability-tag"
            data-plan={isPlanCapability(item) || undefined}
          >
            <motion.span
              className="capability-tag-content"
              initial={reduced ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.15 }}
            >
              <Popover>
                <Button
                  slot={null}
                  variant="ghost"
                  size="sm"
                  className="capability-tag-label"
                  isDisabled={disabled}
                >
                  {isPlanCapability(item) ? <LockKeyhole /> : <CapabilityIcon name={item.icon} />}
                  <span>{item.name}</span>
                  <span className="capability-tag-scope">
                    {t(item.scope === 'session' ? 'capability.scopeChat' : 'capability.scopeOnce')}
                  </span>
                </Button>
                <Popover.Content placement="top start" className="capability-details-popover">
                  <Popover.Dialog aria-label={t('capability.details')}>
                    <CapabilityDetails
                      capability={item}
                      onArguments={item.scope === 'once' && !disabled ? onArguments : undefined}
                    />
                  </Popover.Dialog>
                </Popover.Content>
              </Popover>
            </motion.span>
            <Tag.RemoveButton
              className="capability-tag-remove"
              aria-label={t('capability.removeAction')}
            />
          </Tag>
        )}
      </TagGroup.List>
    </TagGroup>
  )
}
