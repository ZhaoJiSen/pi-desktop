import { Button, Dropdown } from '@heroui/react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { OverflowTooltip } from '../OverflowTooltip'
import type { useGitHistoryLog } from './useGitHistoryLog'

export function GitDateFilter({
  t,
  period,
  setPeriod,
}: Pick<ReturnType<typeof useGitHistoryLog>, 't' | 'period' | 'setPeriod'>) {
  return (
    <Dropdown>
      <Button
        size="sm"
        variant="ghost"
        className="git-log-filter"
        aria-label={`${t('source.date')}: ${t(period === 7 ? 'source.lastWeek' : period === 30 ? 'source.lastMonth' : 'source.anyTime')}`}
        data-active={Boolean(period)}
      >
        <CalendarDays className="git-filter-icon" />
        <OverflowTooltip
          className="git-filter-value"
          text={t(
            period === 7
              ? 'source.lastWeek'
              : period === 30
                ? 'source.lastMonth'
                : 'source.anyTime',
          )}
        />
        <ChevronDown className="git-filter-chevron" />
      </Button>
      <Dropdown.Popover className="action-popover git-history-filter-popover" maxHeight={360}>
        <Dropdown.Menu
          aria-label={t('source.date')}
          selectionMode="single"
          selectedKeys={[String(period)]}
          onAction={(key) => setPeriod(Number(key))}
        >
          <Dropdown.Item id="0">{t('source.anyTime')}</Dropdown.Item>
          <Dropdown.Item id="7">{t('source.lastWeek')}</Dropdown.Item>
          <Dropdown.Item id="30">{t('source.lastMonth')}</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
