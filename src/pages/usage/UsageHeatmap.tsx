import { Button } from '@heroui/react'
import { ArrowDown } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { ActivityCalendar } from 'react-activity-calendar'
import {
  cloneElement,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type SVGProps,
} from 'react'
import { useT } from '../../lib/i18n'
import { tokens } from '../../lib/utils'
import { useWorkspace } from '../../store/workspace'
import type { Session } from '../../types'
import { yearlyUsage, heatLevel } from './usageCharts'

const colors = [
  'var(--usage-day-empty)',
  'color-mix(in srgb, var(--usage-chart-color) 32%, var(--paper))',
  'color-mix(in srgb, var(--usage-chart-color) 55%, var(--paper))',
  'color-mix(in srgb, var(--usage-chart-color) 78%, var(--paper))',
  'var(--usage-chart-color)',
]
const calendarTheme = { light: colors, dark: colors }
const localDate = (timestamp: number) => {
  const day = new Date(timestamp)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

export function UsageHeatmap({
  sessions,
  daySessions,
  selectedDay,
  onSelectDay,
}: {
  sessions: Session[]
  daySessions: number
  selectedDay: number | null
  onSelectDay?: (day: number | null) => void
}) {
  const t = useT()
  const reducedMotion = useReducedMotion()
  const language = useWorkspace((state) => state.language)
  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const help = useId()
  const blocks = useRef<Array<SVGRectElement | null>>([])
  const series = useMemo(() => yearlyUsage(sessions), [sessions])
  const firstFuture = series.findIndex((day) => day.future)
  const todayIndex = firstFuture < 0 ? series.length - 1 : firstFuture - 1
  const [focused, setFocused] = useState(todayIndex)
  const [inspected, setInspected] = useState<number | null>(null)
  const data = useMemo(() => {
    const max = Math.max(...series.map((day) => day.total))
    return series.map((day) => ({
      date: localDate(day.timestamp),
      count: day.total,
      level: heatLevel(day.total, max),
    }))
  }, [series])
  const indexes = useMemo(() => new Map(data.map((day, index) => [day.date, index])), [data])
  const firstDay = series[0].timestamp
  const lastDay = series[series.length - 1].timestamp
  const year = new Date(firstDay).getFullYear()
  const available = series.some((day) => day.messages > 0)
  const total = series.reduce((sum, day) => sum + day.total, 0)
  const activeDays = series.filter((day) => day.total > 0).length
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [locale],
  )
  const label = (index: number) => {
    const day = series[index]
    return `${dayFormatter.format(day.timestamp)} · ${index > todayIndex ? t('usage.futureDate') : day.messages ? `${day.total.toLocaleString(locale)} ${t('usage.tokenUnit')}` : t('usage.noUsage')}`
  }
  const choose = (index: number) => {
    if (index > todayIndex) return
    setFocused(index)
    setInspected(index)
    onSelectDay?.(selectedDay === series[index].timestamp ? null : series[index].timestamp)
  }
  function navigate(event: KeyboardEvent<SVGRectElement>, index: number) {
    if (event.key === 'Escape') {
      setInspected(null)
      onSelectDay?.(null)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(index)
      return
    }
    const deltas: Record<string, number> = {
      ArrowLeft: -7,
      ArrowRight: 7,
      ArrowUp: -1,
      ArrowDown: 1,
    }
    if (!(event.key in deltas) && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? todayIndex
          : Math.max(0, Math.min(todayIndex, index + deltas[event.key]))
    setFocused(next)
    blocks.current[next]?.focus({ preventScroll: true })
    blocks.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  const labels = useMemo(
    () => ({
      months: Array.from({ length: 12 }, (_, month) =>
        new Date(year, month, 1).toLocaleDateString(locale, { month: 'short' }),
      ),
      weekdays: Array.from({ length: 7 }, (_, day) =>
        new Date(2026, 9, 18 + day).toLocaleDateString(locale, { weekday: 'short' }),
      ),
      legend: { less: t('usage.less'), more: t('usage.more') },
    }),
    [locale, t, year],
  )
  return (
    <section className="usage-heatmap usage-chart-panel" aria-label={t('usage.annualUsage')}>
      <header className="usage-chart-heading">
        <h3>{t('usage.annualUsage')}</h3>
        {selectedDay !== null && onSelectDay && (
          <Button variant="ghost" className="usage-clear-day" onPress={() => onSelectDay(null)}>
            {new Date(selectedDay).toLocaleDateString(locale, { month: 'short', day: 'numeric' })} ·{' '}
            {t('usage.clearDay')}
          </Button>
        )}
      </header>
      <p className="usage-heatmap-period" aria-label={t('usage.period')}>
        <time dateTime={localDate(firstDay)}>{localDate(firstDay)}</time>
        <span aria-hidden="true"> — </span>
        <time dateTime={localDate(lastDay)}>{localDate(lastDay)}</time>
      </p>
      <div className="usage-heatmap-summary">
        <p>
          {available
            ? t('usage.yearTokens', { count: tokens(total), year })
            : t('usage.noDatedUsage')}
        </p>
        <span>{t('usage.activeDays', { count: activeDays })}</span>
      </div>
      <ActivityCalendar
        data={data}
        theme={calendarTheme}
        colorScheme="light"
        blockSize={14}
        blockMargin={4}
        blockRadius={3}
        fontSize={13}
        weekStart={0}
        labels={labels}
        showWeekdayLabels={['mon', 'wed', 'fri']}
        showTotalCount={false}
        renderBlock={(block, activity) => {
          const index = indexes.get(activity.date)!
          const selected = selectedDay === series[index].timestamp
          const future = index > todayIndex
          return cloneElement(block as ReactElement<SVGProps<SVGRectElement>>, {
            ref: (element: SVGRectElement | null) => {
              blocks.current[index] = element
            },
            className: future ? 'usage-day is-future' : 'usage-day',
            role: 'button',
            'aria-label': label(index),
            'aria-describedby': help,
            'aria-disabled': future || undefined,
            'aria-pressed': onSelectDay ? selected : undefined,
            tabIndex: !future && focused === index ? 0 : -1,
            style: {
              ...block.props.style,
              stroke: selected ? 'var(--ink)' : 'var(--usage-day-outline)',
              strokeWidth: selected ? 2 : 1,
            },
            onPointerEnter: () => setInspected(index),
            onPointerLeave: () => setInspected(null),
            onFocus: () => {
              if (future) return
              setFocused(index)
              setInspected(index)
            },
            onBlur: () => setInspected(null),
            onKeyDown: (event) => navigate(event, index),
            onClick: () => choose(index),
          })
        }}
      />
      <div className="usage-heatmap-bottom">
        <p className="usage-heatmap-inspection" role="status">
          {inspected !== null
            ? label(inspected)
            : `${t('usage.heatmapNote')}${onSelectDay ? ` ${t('usage.heatmapSelectHint')}` : ''}`}
          {selectedDay !== null && onSelectDay && (
            <Button
              variant="ghost"
              className="usage-day-results"
              onPress={() => {
                const heading = document.getElementById('usage-list-heading')
                heading?.scrollIntoView({
                  behavior: reducedMotion ? 'auto' : 'smooth',
                  block: 'start',
                })
                heading?.focus({ preventScroll: true })
              }}
            >
              {t('usage.viewDayConversations', { count: daySessions })}
              <ArrowDown aria-hidden="true" />
            </Button>
          )}
        </p>
      </div>
      <p className="usage-heatmap-pan">{t('usage.panYear')}</p>
      <p id={help} className="sr-only">
        {t('usage.heatmapKeyboard')} {onSelectDay ? t('usage.selectDayHint') : ''}
      </p>
    </section>
  )
}
