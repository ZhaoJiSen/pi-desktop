import type { ReactNode } from 'react'
import { Tooltip } from '@heroui/react'
import { useTextTruncated } from '../../../hooks/useTextTruncated'

export function PackageSortLabel({ label, icon }: { label: string; icon: ReactNode }) {
  const { ref, truncated } = useTextTruncated(label)

  return (
    <Tooltip delay={450} closeDelay={100} isDisabled={!truncated}>
      <Tooltip.Trigger<'span'>
        render={(props) => <span {...props} />}
        className="package-sort-label"
        role={undefined}
        tabIndex={-1}
      >
        {icon}
        <span ref={ref} className="package-sort-text">
          {label}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content placement="top" offset={6} className="package-name-tooltip">
        {label}
      </Tooltip.Content>
    </Tooltip>
  )
}
