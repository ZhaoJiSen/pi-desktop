import { Button, Popover, SearchField } from '@heroui/react'
import { ChevronDown, GitBranch } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { gitBranches } from '../../lib/source/api'
import { branchReference } from '../../lib/source/branches'
import { GitBranchActions } from './GitBranchActions'
import { useSourceQuery } from './useSourceQuery'

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
        aria-label={`${t('source.currentBranch')}: ${current?.name ?? t('source.detachedHead')}`}
      >
        <GitBranch />
        <span>{current?.name ?? t('source.detachedHead')}</span>
        <ChevronDown />
      </Button>
      <Popover.Content className="git-branch-picker-popover" placement="bottom end" offset={8}>
        <Popover.Dialog aria-label={t('source.currentBranch')}>
          <SearchField
            className="git-search"
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
          <div className="git-branch-picker-list">
            {[false, true].map((remote) => {
              const items = (branches.data ?? []).filter(
                (item) =>
                  item.remote === remote && item.name.toLowerCase().includes(query.toLowerCase()),
              )
              return items.length ? (
                <section key={String(remote)}>
                  <h2>{t(remote ? 'source.remoteBranches' : 'source.localBranches')}</h2>
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
                      {item.current && <small>{t('source.currentBranch')}</small>}
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
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
