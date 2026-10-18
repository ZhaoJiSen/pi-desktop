import { Description, Label, Switch } from '@heroui/react'

export function SettingsSwitch({
  label,
  description,
  isSelected,
  onChange,
}: {
  label: string
  description: string
  isSelected: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <Switch className="settings-switch" isSelected={isSelected} onChange={onChange}>
      <Switch.Content>
        <Label>{label}</Label>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
      <Description>{description}</Description>
    </Switch>
  )
}
