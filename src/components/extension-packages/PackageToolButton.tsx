import { Button, Tooltip } from '@heroui/react'
import type { ComponentProps } from 'react'

type Props = ComponentProps<typeof Button> & { label: string }

export function PackageToolButton({ label, className = '', ...props }: Props) {
  return (
    <Tooltip delay={400}>
      <Button
        {...props}
        variant="ghost"
        isIconOnly
        aria-label={label}
        className={`package-tool-button ${className}`}
      />
      <Tooltip.Content placement="top" offset={6} className="package-name-tooltip">
        {label}
      </Tooltip.Content>
    </Tooltip>
  )
}
