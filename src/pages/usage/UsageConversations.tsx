import { OverflowTooltip } from '../../components/OverflowTooltip'
import { Button, SearchField } from '@heroui/react'
import { ArrowDown, ArrowRight, ArrowUp, ChartNoAxesColumn, SearchX } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { useWorkspace } from '../../store/workspace'
import { tokens } from '../../lib/utils'
import { selectChat } from '../../router/navigation'
import { hasUsage, money } from './usageData'
import { UsageProjectFilter } from './UsageProjectFilter'
import type { UsageController } from './useUsagePage'

export function UsageConversations({
  showAllTools,
  activeProject,
  project,
  setProject,
  availableProjects,
  selectedDay,
  selectDay,
  rowUsage,
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
  | 'activeProject'
  | 'project'
  | 'setProject'
  | 'availableProjects'
  | 'selectedDay'
  | 'selectDay'
  | 'rowUsage'
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
  const language = useWorkspace((state) => state.language)
  return (
    <section className="usage-conversations" aria-label={t('usage.conversationDetails')}>
      {showAllTools && (
        <div className="usage-list-toolbar">
          <h2 id="usage-list-heading" tabIndex={-1} aria-live="polite">
            {t('usage.conversationDetails')}
            <span>{rows.length}</span>
            {selectedDay !== null && (
              <Button variant="ghost" className="usage-clear-day" onPress={() => selectDay(null)}>
                {new Date(selectedDay).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                · {t('usage.clearDay')}
              </Button>
            )}
          </h2>
          <div className="usage-list-filters">
            <UsageProjectFilter {...{ activeProject, project, setProject, availableProjects }} />
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
                      aria-label={t(
                        selectedDay !== null
                          ? key === 'cost'
                            ? 'usage.dailyCost'
                            : 'usage.dailyTokens'
                          : key === 'cost'
                            ? 'usage.estimatedCost'
                            : 'usage.tokens',
                      )}
                      onPress={() => changeSort(key)}
                    >
                      {t(
                        selectedDay !== null
                          ? key === 'cost'
                            ? 'usage.dailyCost'
                            : 'usage.dailyTokens'
                          : key === 'cost'
                            ? 'usage.costColumn'
                            : 'usage.tokens',
                      )}
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
                    <OverflowTooltip
                      text={item.modelKey.split('/').slice(1).join('/') || '—'}
                      tooltip={item.modelKey}
                    />
                  </td>
                  <td
                    className="usage-number"
                    title={
                      selectedDay !== null || hasUsage(item)
                        ? rowUsage(item).total.toLocaleString()
                        : undefined
                    }
                  >
                    {selectedDay !== null || hasUsage(item) ? tokens(rowUsage(item).total) : '—'}
                  </td>
                  <td className="usage-number">
                    {selectedDay !== null || hasUsage(item) ? money(rowUsage(item).cost) : '—'}
                  </td>
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
