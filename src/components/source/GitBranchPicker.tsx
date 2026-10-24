import { Button, Popover, SearchField, Skeleton } from '@heroui/react'
import { Check, ChevronDown, GitBranch } from 'lucide-react'
import { useState } from 'react'
import { OverflowTooltip } from '../OverflowTooltip'
import { useT } from '../../lib/i18n'
import { gitBranches } from '../../lib/source/api'
import { branchReference } from '../../lib/source/branches'
import { branchKind } from '../../lib/source/historyLabels'
import { GitBranchActions } from './GitBranchActions'
import { useSourceQuery } from './useSourceQuery'
import { HoverScrollArea } from '../HoverScrollArea'

export function GitBranchPicker({
  projectPath,
  tick,
  onChanged,
}: {
  projectPath: string
  tick: number
  onChanged: () => void
}) {
  const t = useT()
  const branches = useSourceQuery(
    projectPath ? `page-branches:${projectPath}` : null,
    () => gitBranches(projectPath),
    tick,
  )
  const current = branches.data?.find((item) => item.current)
  const [query, setQuery] = useState('')
  return (
    <Popover>
      <Button
        isDisabled={!projectPath}
        variant="ghost"
        size="sm"
        className="git-current-branch-picker"
        aria-label={`${t('source.currentBranch')}: ${branches.loading ? t('source.loading') : (current?.name ?? t('source.detachedHead'))}`}
      >
        <GitBranch className="git-kind" data-kind={branchKind(current?.name ?? '')} />
        <OverflowTooltip text={current?.name ?? t('source.detachedHead')}>
          {branches.loading ? (
            <Skeleton animationType="pulse" className="git-skeleton-bar" style={{ width: 40 }} />
          ) : (
            (current?.name ?? t('source.detachedHead'))
          )}
        </OverflowTooltip>
        <ChevronDown />
      </Button>
      <Popover.Content
        className="git-context-popover git-branch-picker-popover"
        placement="bottom start"
        offset={8}
      >
        <Popover.Dialog aria-label={t('source.currentBranch')}>
          <div className="git-context-picker-search">
            <SearchField
              className="git-search"
              variant="secondary"
              aria-label={t('source.searchBranches')}
              value={query}
              onChange={setQuery}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={t('source.searchBranches')} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
          <HoverScrollArea
            className="git-context-picker-scroll git-branch-picker-list"
            label={t('source.branches')}
            shadowSize={16}
          >
            {[false, true].map((remote) => {
              const items = (branches.data ?? []).filter(
                (item) =>
                  item.remote === remote && item.name.toLowerCase().includes(query.toLowerCase()),
              )
              return items.length ? (
                <section key={String(remote)}>
                  <h2>
                    <span>{t(remote ? 'source.remoteBranches' : 'source.localBranches')}</span>
                    <small>{items.length}</small>
                  </h2>
                  {items.map((item) => (
                    <div
                      key={branchReference(item)}
                      className="git-picker-branch"
                      data-current={item.current || undefined}
                    >
                      <GitBranchActions
                        trigger="choice"
                        projectPath={projectPath}
                        branch={item}
                        tick={tick}
                        onChanged={onChanged}
                      />
                      {item.current && (
                        <Check
                          className="git-picker-current"
                          role="img"
                          aria-label={t('source.currentBranch')}
                        />
                      )}
                    </div>
                  ))}
                </section>
              ) : null
            })}
            {branches.loading && <p role="status">{t('source.loading')}</p>}
            {branches.error && <p role="alert">{branches.error}</p>}
            {branches.data &&
              !branches.data.some((item) =>
                item.name.toLowerCase().includes(query.toLowerCase()),
              ) && <p>{t('source.emptyBranches')}</p>}
          </HoverScrollArea>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
