import { Button, SearchField } from '@heroui/react'
import { ArrowDown, ArrowRight, ArrowUp, ChartNoAxesColumn, SearchX } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { tokens } from '../../lib/utils'
import { selectChat } from '../../router/navigation'
import { hasUsage, money } from './usageData'
import type { UsageController } from './useUsagePage'

export function UsageConversations({
  showAllTools,
  chosen,
  query,
  setQuery,
  rows,
  sort,
  ascending,
  changeSort,
  projectName,
  filtered,
  clearFilters,
}: Pick<
  UsageController,
  | 'showAllTools'
  | 'chosen'
  | 'query'
  | 'setQuery'
  | 'rows'
  | 'sort'
  | 'ascending'
  | 'changeSort'
  | 'projectName'
  | 'filtered'
  | 'clearFilters'
>) {
  const t = useT()
  return (
    <section className="usage-conversations" aria-label={t('usage.conversationDetails')}>
      {showAllTools && (
        <div className="usage-list-toolbar">
          <h2 id="usage-list-heading">
            {t('usage.conversationDetails')}
            <span>{chosen.length}</span>
          </h2>
          <SearchField
            className="usage-search"
            aria-label={t('usage.search')}
            value={query}
            onChange={setQuery}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={t('usage.searchPlaceholder')} />
              <SearchField.ClearButton aria-label={t('packages.clearSearch')} />
            </SearchField.Group>
          </SearchField>
        </div>
      )}
      {rows.length ? (
        <div className="table-scroll">
          <table className="usage-table">
            <thead>
              <tr>
                <th scope="col">{t('usage.conversation')}</th>
                <th scope="col" className="usage-model-column">
                  {t('usage.currentModel')}
                </th>
                {(['total', 'cost'] as const).map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className="usage-number"
                    aria-sort={sort === key ? (ascending ? 'ascending' : 'descending') : 'none'}
                  >
                    <Button
                      variant="ghost"
                      className="usage-sort"
                      aria-label={t(key === 'cost' ? 'usage.estimatedCost' : 'usage.tokens')}
                      onPress={() => changeSort(key)}
                    >
                      {t(key === 'cost' ? 'usage.costColumn' : 'usage.tokens')}
                      {sort === key ? (
                        ascending ? (
                          <ArrowUp aria-hidden="true" />
                        ) : (
                          <ArrowDown aria-hidden="true" />
                        )
                      ) : (
                        <span className="usage-sort-placeholder" />
                      )}
                    </Button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Button
                      variant="ghost"
                      className="usage-session-link"
                      onPress={() => selectChat(item.id)}
                    >
                      <span>{item.title || t('sessions.new')}</span>
                      <ArrowRight aria-hidden="true" />
                    </Button>
                    <div className="usage-project-name">{projectName(item)}</div>
                  </td>
                  <td className="usage-model-column">
                    <span title={item.modelKey}>
                      {item.modelKey.split('/').slice(1).join('/') || '—'}
                    </span>
                  </td>
                  <td
                    className="usage-number"
                    title={hasUsage(item) ? item.usage.total.toLocaleString() : undefined}
                  >
                    {hasUsage(item) ? tokens(item.usage.total) : '—'}
                  </td>
                  <td className="usage-number">{hasUsage(item) ? money(item.usage.cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="usage-empty" role="status">
          {filtered ? <SearchX aria-hidden="true" /> : <ChartNoAxesColumn aria-hidden="true" />}
          <h3>{t(filtered ? 'usage.noResults' : 'usage.noUsage')}</h3>
          <p>{t(filtered ? 'usage.adjustFilters' : 'usage.noUsageHint')}</p>
          {filtered && (
            <Button variant="ghost" onPress={clearFilters}>
              {t('usage.clearFilters')}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
