import { useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { isRecentProject } from '../../lib/recentProject'
import { useWorkspace } from '../../store/workspace'
import type { Session } from '../../types'
import { parts, hasUsage, hasActivity } from './usageData'
import { useUsageViewState } from './usageViewState'
import { usageOnDay } from './usageCharts'

const costNoticeKey = 'pi.usage-cost-notice-dismissed.v1'

export function useUsagePage() {
  const sessions = useWorkspace((state) => state.sessions)
  const projects = useWorkspace((state) => state.projects)
  const active = useWorkspace((state) => state.activeSessionId)
  const session = sessions.find((item) => item.id === active)
  const { scope, project, query, sort, ascending, selectedDay } = useUsageViewState()
  const setProject = (value: string) => useUsageViewState.setState({ project: value })
  const setQuery = (value: string) => useUsageViewState.setState({ query: value })
  const selectDay = (value: number | null) => useUsageViewState.setState({ selectedDay: value })
  const [costHelpOpen, setCostHelpOpen] = useState(false)
  const costHelpButton = useRef<HTMLButtonElement>(null)
  const [noticeDismissed, setNoticeDismissed] = useState(() => {
    try {
      return localStorage.getItem(costNoticeKey) === 'true'
    } catch {
      return false
    }
  })
  function dismissCostNotice() {
    setNoticeDismissed(true)
    costHelpButton.current?.focus()
    try {
      localStorage.setItem(costNoticeKey, 'true')
    } catch {
      // Keep the notice dismissed for this visit if storage is unavailable.
    }
  }
  const t = useT()
  const projectNames = new Map(
    projects.map((item) => [
      item.id,
      isRecentProject(item) ? t('projects.recentChats') : item.name,
    ]),
  )
  const projectName = (item: Session) => projectNames.get(item.projectId) || item.projectId || '—'
  const effectiveProject = projectNames.has(project) ? project : 'all'
  const search = query.trim().toLocaleLowerCase()
  const chosen =
    scope === 'current'
      ? session && hasActivity(session)
        ? [session]
        : []
      : sessions.filter(
          (item) =>
            hasActivity(item) &&
            (effectiveProject === 'all' || item.projectId === effectiveProject) &&
            `${item.title} ${projectName(item)} ${item.modelKey}`
              .toLocaleLowerCase()
              .includes(search),
        )
  const recorded = chosen.filter(hasUsage)
  const total = recorded.reduce(
    (sum, item) => ({
      input: sum.input + item.usage.input,
      output: sum.output + item.usage.output,
      cacheRead: sum.cacheRead + item.usage.cacheRead,
      cacheWrite: sum.cacheWrite + item.usage.cacheWrite,
      total: sum.total + item.usage.total,
      cost: sum.cost + item.usage.cost,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0 },
  )
  const rowUsage = (item: Session) =>
    selectedDay !== null && scope === 'all' ? usageOnDay(item, selectedDay) : item.usage
  const rows = chosen
    .filter(
      (item) =>
        selectedDay === null || scope !== 'all' || usageOnDay(item, selectedDay).messages > 0,
    )
    .sort((a, b) => {
      // Keep sessions without recorded usage below known values, in either direction.
      if (selectedDay === null && hasUsage(a) !== hasUsage(b)) return hasUsage(a) ? -1 : 1
      return (
        (ascending ? 1 : -1) * (rowUsage(a)[sort] - rowUsage(b)[sort]) || b.updatedAt - a.updatedAt
      )
    })
  const partTotal = parts.reduce((sum, key) => sum + total[key], 0)
  const availableProjects = projects
    .filter((item) => sessions.some((entry) => entry.projectId === item.id && hasActivity(entry)))
    .map((item) => ({
      ...item,
      name: isRecentProject(item) ? t('projects.recentChats') : item.name,
    }))
  const activeProject = availableProjects.find((item) => item.id === project)
  const filtered = effectiveProject !== 'all' || Boolean(search) || selectedDay !== null
  const known = recorded.length > 0
  const emptyView = scope === 'current' ? !known : !known && rows.length === 0
  const showAllTools = sessions.some(hasActivity) || filtered

  function changeSort(key: typeof sort) {
    if (sort === key) useUsageViewState.setState({ ascending: !ascending })
    else {
      useUsageViewState.setState({ sort: key, ascending: false })
    }
  }

  function clearFilters() {
    setQuery('')
    setProject('all')
    selectDay(null)
  }
  function changeScope(value: typeof scope) {
    useUsageViewState.setState({ scope: value })
    setCostHelpOpen(false)
  }
  return {
    scope,
    changeScope,
    project,
    setProject,
    activeProject,
    availableProjects,
    session,
    projectName,
    query,
    setQuery,
    sort,
    ascending,
    changeSort,
    noticeDismissed,
    dismissCostNotice,
    costHelpOpen,
    setCostHelpOpen,
    costHelpButton,
    chosen,
    recorded,
    total,
    rows,
    rowUsage,
    selectedDay,
    selectDay,
    partTotal,
    filtered,
    known,
    emptyView,
    showAllTools,
    clearFilters,
  }
}

export type UsageController = ReturnType<typeof useUsagePage>
