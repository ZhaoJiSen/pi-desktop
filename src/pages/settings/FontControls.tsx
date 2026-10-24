import { ListBox, NumberField, Select } from '@heroui/react'
import { useMemo, useState } from 'react'
import { quoteFamily, type FontLeading, type SystemFont } from '../../lib/fonts'
import { useT } from '../../lib/i18n'
import { leadings, systemId } from './fontOptions'

export function SizeField({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number
  min: number
  max: number
  label: string
  onChange: (value: number) => void
}) {
  const t = useT()
  return (
    <NumberField
      className="settings-font-number"
      variant="secondary"
      aria-label={label}
      value={value}
      minValue={min}
      maxValue={max}
      step={1}
      onChange={(next) => {
        if (typeof next === 'number' && Number.isFinite(next)) onChange(Math.round(next))
      }}
    >
      <NumberField.Group>
        <NumberField.DecrementButton aria-label={t('settings.fonts.decrease')} />
        <NumberField.Input />
        <NumberField.IncrementButton aria-label={t('settings.fonts.increase')} />
      </NumberField.Group>
    </NumberField>
  )
}

export function LeadingSelect({
  value,
  onChange,
}: {
  value: FontLeading
  onChange: (value: FontLeading) => void
}) {
  const t = useT()
  return (
    <Select
      className="settings-font-leading"
      variant="secondary"
      aria-label={t('settings.fonts.leading')}
      value={value}
      onChange={(next) => {
        if (leadings.includes(next as FontLeading)) onChange(next as FontLeading)
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover placement="bottom end">
        <ListBox>
          {leadings.map((item) => (
            <ListBox.Item key={item} id={item} textValue={t(`settings.fonts.leading.${item}`)}>
              {t(`settings.fonts.leading.${item}`)}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

export function FontSelect({
  labelId,
  value,
  fonts,
  systemLabel,
  missing,
  onChange,
}: {
  labelId: string
  value: string | null
  fonts: SystemFont[]
  systemLabel: string
  missing: boolean
  onChange: (family: string | null) => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const names = useMemo(() => {
    const installed = fonts.map((font) => font.family)
    const listed = value && !installed.includes(value) ? [value, ...installed] : installed
    const needle = query.trim().toLowerCase()
    return listed.filter((family) => family.toLowerCase().includes(needle))
  }, [fonts, query, value])
  const showSystem = !query.trim() || systemLabel.toLowerCase().includes(query.trim().toLowerCase())
  return (
    <Select
      className="settings-font-select"
      variant="secondary"
      aria-labelledby={labelId}
      value={value ?? systemId}
      onChange={(next) => {
        if (next == null) return
        onChange(String(next) === systemId ? null : String(next))
      }}
      onOpenChange={(open) => {
        if (!open) setQuery('')
      }}
    >
      <Select.Trigger>
        <Select.Value>
          <span style={value && !missing ? { fontFamily: quoteFamily(value) } : undefined}>
            {value ?? systemLabel}
          </span>
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="settings-font-popover" placement="bottom end">
        <input
          className="settings-font-search"
          aria-label={t('settings.fonts.search')}
          placeholder={t('settings.fonts.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <ListBox className="settings-font-options" aria-label={t('settings.fonts.choose')}>
          {showSystem && (
            <ListBox.Item id={systemId} textValue={systemLabel}>
              {systemLabel}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
          {names.map((family) => (
            <ListBox.Item key={family} id={family} textValue={family}>
              <span style={{ fontFamily: quoteFamily(family) }}>{family}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
        {!showSystem && !names.length && (
          <p className="settings-font-empty">{t('settings.fonts.empty')}</p>
        )}
      </Select.Popover>
    </Select>
  )
}
