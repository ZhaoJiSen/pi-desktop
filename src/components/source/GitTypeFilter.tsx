import { Button, Chip, Dropdown } from '@heroui/react'
import { ChevronDown, ListFilter } from 'lucide-react'
import { commitKinds } from '../../lib/source/historyLabels'
import type { useGitHistoryLog } from './useGitHistoryLog'

export function GitTypeFilter({
  t,
  kind,
  setKind,
  commits,
  kindCounts,
}: Pick<ReturnType<typeof useGitHistoryLog>, 't' | 'kind' | 'setKind' | 'commits' | 'kindCounts'>) {
  return (
    <Dropdown>
      <Button
        size="sm"
        variant="ghost"
        className="git-log-filter"
        aria-label={`${t('source.commitType')}: ${kind === 'all' ? t('source.allTypes') : kind === 'branch' ? t('source.otherType') : kind}`}
        data-active={kind !== 'all'}
      >
        <ListFilter className="git-filter-icon" />
        <span className="git-filter-value">
          {kind === 'all' ? t('source.allTypes') : kind === 'branch' ? t('source.otherType') : kind}
        </span>
        <ChevronDown className="git-filter-chevron" />
      </Button>
      <Dropdown.Popover
        className="action-popover git-history-filter-popover git-type-popover"
        maxHeight={360}
      >
        <Dropdown.Menu
          aria-label={t('source.commitType')}
          selectionMode="single"
          selectedKeys={[kind]}
          onAction={(key) => setKind(String(key))}
        >
          <Dropdown.Item id="all" textValue={t('source.allTypes')}>
            <span>{t('source.allTypes')}</span>
            <small className="git-type-count">{commits.length}</small>
            <Dropdown.ItemIndicator />
          </Dropdown.Item>
          {[...commitKinds, 'branch']
            .filter((value) => kindCounts.has(value) || kind === value)
            .map((value) => (
              <Dropdown.Item
                key={value}
                id={value}
                textValue={value === 'branch' ? t('source.otherType') : value}
              >
                <Chip size="sm" variant="soft" className="git-kind" data-kind={value}>
                  {value === 'branch' ? t('source.otherType') : value}
                </Chip>
                <small className="git-type-count">{kindCounts.get(value) ?? 0}</small>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
