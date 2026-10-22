import { Button, Tooltip } from '@heroui/react'
import type { ReactNode } from 'react'

export function SourceAction({
  label,
  children,
  onPress,
  isDisabled,
  pressed,
}: {
  label: string
  children: ReactNode
  onPress: () => void
  isDisabled?: boolean
  pressed?: boolean
}) {
  return (
    <Tooltip delay={450}>
      <Tooltip.Trigger role="presentation" tabIndex={-1}>
        <Button
          isIconOnly
          variant="ghost"
          className="icon-button"
          aria-label={label}
          aria-pressed={pressed}
          isDisabled={isDisabled}
          onPress={onPress}
        >
          {children}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content placement="bottom" offset={6}>
        {label}
      </Tooltip.Content>
    </Tooltip>
  )
}
