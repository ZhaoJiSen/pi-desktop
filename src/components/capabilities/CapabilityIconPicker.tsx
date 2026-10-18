import { Button, Popover, Tooltip } from '@heroui/react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { lucideName, lucideNames, type CapabilityIconName } from '../../lib/capabilities/icons'
import { useT } from '../../lib/i18n'
import { CapabilityIcon } from './CapabilityIcon'
import { CapabilitySearch } from './CapabilitySearch'
const pageSize = 48
export function CapabilityIconPicker({
  value,
  onChange,
}: {
  value: CapabilityIconName
  onChange: (value: CapabilityIconName) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(0)
  const filtered = lucideNames.filter((name) =>
    name.includes(search.trim().toLowerCase().replaceAll(' ', '-')),
  )
  const current = lucideName(value)
  return (
    <div className="capability-icon-field">
      <span id="capability-icon-label">{t('capability.icon')}</span>
      <Popover isOpen={open} onOpenChange={setOpen}>
        <Button
          variant="secondary"
          aria-label={t('library.chooseIcon')}
          className="capability-icon-trigger"
        >
          <CapabilityIcon name={value} />
          <span>{current}</span>
          <ChevronDown />
        </Button>
        <Popover.Content
          className="capability-icon-picker"
          placement="bottom start"
          offset={8}
          containerPadding={16}
        >
          <Popover.Dialog aria-label={t('library.chooseIcon')}>
            <CapabilitySearch
              value={search}
              onChange={(value) => {
                setSearch(value)
                setPage(0)
              }}
              autoFocus
              placeholder={t('library.searchIcons')}
            />
            <div
              className="capability-icon-grid"
              role="group"
              aria-label={t('library.lucideIcons')}
            >
              {filtered.slice(page * pageSize, (page + 1) * pageSize).map((name) => (
                <Tooltip key={name} delay={400}>
                  <Button
                    variant="ghost"
                    isIconOnly
                    aria-label={name}
                    aria-pressed={name === current}
                    onPress={() => {
                      onChange(`lucide:${name}`)
                      setOpen(false)
                    }}
                  >
                    <CapabilityIcon name={`lucide:${name}`} />
                  </Button>
                  <Tooltip.Content placement="top" className="sidebar-option-tooltip">
                    {name}
                  </Tooltip.Content>
                </Tooltip>
              ))}
            </div>
            {!filtered.length && <p className="settings-help">{t('library.noIcons')}</p>}
            <div className="capability-icon-pagination">
              <span>{t('library.iconCount', { count: filtered.length })}</span>
              <Button
                variant="ghost"
                isIconOnly
                size="sm"
                aria-label={t('library.previousIcons')}
                isDisabled={page === 0}
                onPress={() => setPage(page - 1)}
              >
                <ChevronLeft />
              </Button>
              <span>
                {page + 1} / {Math.max(1, Math.ceil(filtered.length / pageSize))}
              </span>
              <Button
                variant="ghost"
                isIconOnly
                size="sm"
                aria-label={t('library.nextIcons')}
                isDisabled={(page + 1) * pageSize >= filtered.length}
                onPress={() => setPage(page + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  )
}
