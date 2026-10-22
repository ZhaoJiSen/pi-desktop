import { ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useId, type ReactNode } from 'react'

/** Keep HeroUI's keyboard selection and share one moving selection surface. */
export function SourceViewTabs<T extends string>({
  label,
  selected,
  items,
  onSelect,
  secondary = false,
}: {
  label: string
  selected: T
  items: { id: T; label: string; icon?: ReactNode }[]
  onSelect: (id: T) => void
  secondary?: boolean
}) {
  const id = useId()
  const reduced = useReducedMotion()
  return (
    <LayoutGroup id={id}>
      <ToggleButtonGroup
        className={secondary ? 'source-git-tabs' : 'source-primary-tabs'}
        aria-label={label}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[selected]}
        onSelectionChange={(keys) => {
          const item = items.find((item) => keys.has(item.id))
          if (item) onSelect(item.id)
        }}
      >
        {items.map((item) => (
          <ToggleButton key={item.id} id={item.id} aria-label={item.label}>
            {selected === item.id && (
              <motion.span
                className="source-tab-indicator"
                layoutId="selection"
                aria-hidden="true"
                initial={false}
                transition={
                  reduced ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 38 }
                }
              />
            )}
            <span className="source-tab-label">
              {item.icon}
              {item.label}
            </span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </LayoutGroup>
  )
}
