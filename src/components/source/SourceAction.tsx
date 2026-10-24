import { Button, Tooltip } from '@heroui/react'
import type { ReactNode, Ref } from 'react'

export function SourceAction({
  label,
  children,
  onPress,
  isDisabled,
  pressed,
  buttonRef,
}: {
  label: string
  children: ReactNode
  onPress: () => void
  isDisabled?: boolean
  pressed?: boolean
  buttonRef?: Ref<HTMLButtonElement>
}) {
  return (
    <Tooltip delay={450}>
      <Tooltip.Trigger role="presentation" tabIndex={-1}>
        <Button
          ref={buttonRef}
          isIconOnly
          size="sm"
          variant={pressed ? 'secondary' : 'ghost'}
          className="source-action"
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
