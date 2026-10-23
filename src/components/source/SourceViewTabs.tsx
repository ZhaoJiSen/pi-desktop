import { Tabs } from '@heroui/react'
import type { ReactNode } from 'react'

/** Let HeroUI own tab geometry, keyboard navigation and selection transitions. */
export function SourceViewTabs<T extends string>({
  label,
  selected,
  items,
  onSelect,
  secondary = false,
}: {
  label: string
  selected: T
  items: { id: T; label: string; icon?: ReactNode; badge?: ReactNode }[]
  onSelect: (id: T) => void
  secondary?: boolean
}) {
  return (
    <Tabs
      className={secondary ? 'source-git-tabs' : 'source-primary-tabs'}
      variant={secondary ? 'secondary' : 'primary'}
      selectedKey={selected}
      onSelectionChange={(key) => {
        const item = items.find((item) => item.id === key)
        if (item) onSelect(item.id)
      }}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label={label}>
          {items.map((item) => (
            <Tabs.Tab key={item.id} id={item.id} aria-label={item.label}>
              <span className="source-tab-label">
                {item.icon}
                {item.label}
                {item.badge}
              </span>
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}
