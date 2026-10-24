import { Button, Dropdown } from '@heroui/react'
import { ChevronDown, UserRound } from 'lucide-react'
import { OverflowTooltip } from '../OverflowTooltip'
import type { useGitHistoryLog } from './useGitHistoryLog'

export function GitAuthorFilter({
  t,
  author,
  setAuthor,
  authors,
}: Pick<ReturnType<typeof useGitHistoryLog>, 't' | 'author' | 'setAuthor' | 'authors'>) {
  return (
    <Dropdown>
      <Button
        size="sm"
        variant="ghost"
        className="git-log-filter"
        aria-label={`${t('source.author')}: ${author || t('source.allAuthors')}`}
        data-active={Boolean(author)}
      >
        <UserRound className="git-filter-icon" />
        <OverflowTooltip className="git-filter-value" text={author || t('source.allAuthors')} />
        <ChevronDown className="git-filter-chevron" />
      </Button>
      <Dropdown.Popover className="action-popover git-history-filter-popover" maxHeight={360}>
        <Dropdown.Menu
          aria-label={t('source.author')}
          selectionMode="single"
          selectedKeys={[author || 'all']}
          onAction={(key) => setAuthor(key === 'all' ? '' : String(key))}
        >
          <Dropdown.Item id="all">{t('source.allAuthors')}</Dropdown.Item>
          {authors.map((item) => (
            <Dropdown.Item key={item} id={item}>
              {item}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
