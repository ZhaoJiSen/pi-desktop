import { Tooltip } from '@heroui/react'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTextTruncated } from '../hooks/useTextTruncated'

export function SidebarOption({
  icon,
  title,
  subtitle,
  badge,
  accessory,
  trailing,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  badge?: ReactNode
  accessory?: ReactNode
  trailing?: ReactNode
}) {
  const { ref: titleRef, truncated } = useTextTruncated(title)

  return (
    <>
      {icon && (
        <span className="sidebar-option-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="sidebar-option-copy">
        <Tooltip delay={450} closeDelay={100} isDisabled={!truncated}>
          <Tooltip.Trigger<'span'>
            render={(props) => <span {...props} />}
            className="sidebar-option-title"
            role={undefined}
            tabIndex={-1}
          >
            <strong ref={titleRef}>{title}</strong>
          </Tooltip.Trigger>
          <Tooltip.Content placement="top start" offset={4} className="sidebar-option-tooltip">
            {title}
          </Tooltip.Content>
        </Tooltip>
        {(subtitle || badge) && (
          <span className="sidebar-option-meta">
            {subtitle && <small>{subtitle}</small>}
            {badge}
          </span>
        )}
      </span>
      {accessory}
      {trailing === undefined ? <ChevronRight aria-hidden="true" /> : trailing}
    </>
  )
}
