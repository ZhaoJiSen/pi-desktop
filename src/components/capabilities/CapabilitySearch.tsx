import { SearchField } from '@heroui/react'
import { useT } from '../../lib/i18n'

export function CapabilitySearch({
  value,
  onChange,
  autoFocus = false,
  onNavigate,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  placeholder?: string
  onNavigate?: () => void
}) {
  const t = useT()
  return (
    <SearchField
      className="capability-search"
      variant="secondary"
      value={value}
      onChange={onChange}
      aria-label={placeholder || t('capability.search')}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' && onNavigate) {
          event.preventDefault()
          onNavigate()
        }
      }}
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          placeholder={placeholder || t('capability.search')}
          autoFocus={autoFocus}
        />
        <SearchField.ClearButton aria-label={t('capability.clearSearch')} />
      </SearchField.Group>
    </SearchField>
  )
}
