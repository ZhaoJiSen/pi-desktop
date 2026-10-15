import { useRef, useState } from 'react'
import { useWorkspace } from '../../store/workspace'
import type { Session } from '../../types'
import { parts, hasUsage, hasActivity } from './usageData'

const costNoticeKey = 'pi.usage-cost-notice-dismissed.v1'

export function useUsagePage() {
  const sessions = useWorkspace((state) => state.sessions)
  const projects = useWorkspace((state) => state.projects)
  const active = useWorkspace((state) => state.activeSessionId)
  const session = sessions.find((item) => item.id === active)
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const [project, setProject] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'cost' | 'total'>('cost')
  const [ascending, setAscending] = useState(false)
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
  const projectNames = new Map(projects.map((item) => [item.id, item.name]))
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
  const rows = [...chosen].sort((a, b) => {
    // Keep sessions without recorded usage below known values, in either direction.
    if (hasUsage(a) !== hasUsage(b)) return hasUsage(a) ? -1 : 1
    return (ascending ? 1 : -1) * (a.usage[sort] - b.usage[sort]) || b.updatedAt - a.updatedAt
  })
  const partTotal = parts.reduce((sum, key) => sum + total[key], 0)
  const availableProjects = projects.filter((item) =>
    sessions.some((entry) => entry.projectId === item.id && hasActivity(entry)),
  )
  const activeProject = availableProjects.find((item) => item.id === project)
  const filtered = effectiveProject !== 'all' || Boolean(search)
  const known = recorded.length > 0
  const emptyView = scope === 'current' ? !known : rows.length === 0
  const showAllTools = sessions.some(hasActivity) || filtered

  function changeSort(key: typeof sort) {
    if (sort === key) setAscending((value) => !value)
    else {
      setSort(key)
      setAscending(false)
    }
  }

  function clearFilters() {
    setQuery('')
    setProject('all')
  }
  function changeScope(value: typeof scope) {
    setScope(value)
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
    partTotal,
    filtered,
    known,
    emptyView,
    showAllTools,
    clearFilters,
  }
}

export type UsageController = ReturnType<typeof useUsagePage>
