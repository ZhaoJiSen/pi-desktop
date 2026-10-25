import { ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { ChartNoAxesCombined } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import { tokens } from '../../lib/utils'
import { money } from './usageData'
import { dailyUsage, type UsageDay } from './usageCharts'
import type { Session } from '../../types'
import { useUsageViewState } from './usageViewState'

function UsageTooltip({
  active,
  payload,
  metric,
  date,
  inspect,
}: Partial<TooltipContentProps> & {
  metric: 'total' | 'cost'
  date: (timestamp: number) => string
  inspect: (timestamp: number) => void
}) {
  const t = useT()
  const day = payload?.[0]?.payload as UsageDay | undefined
  useEffect(() => {
    if (active && day) inspect(day.timestamp)
  }, [active, day, inspect])
  if (!active || !day) return null
  return (
    <div className="usage-chart-tooltip">
      <span>{date(day.timestamp)}</span>
      <strong>
        {day.messages
          ? metric === 'cost'
            ? money(day.cost)
            : `${tokens(day.total)} ${t('usage.tokenUnit')}`
          : t('usage.noUsage')}
      </strong>
    </div>
  )
}

export function UsageTrend({
  sessions,
  selectedDay,
  onSelectDay,
}: {
  sessions: Session[]
  selectedDay: number | null
  onSelectDay?: (day: number | null) => void
}) {
  const t = useT()
  const language = useWorkspace((state) => state.language)
  const { metric, days } = useUsageViewState()
  const setMetric = (value: 'total' | 'cost') => useUsageViewState.setState({ metric: value })
  const setDays = (value: number) => useUsageViewState.setState({ days: value })
  const gradient = useId()
  const help = useId()
  const reducedMotion = useReducedMotion()
  const inspectedDay = useRef<number | null>(null)
  const inspect = useCallback((timestamp: number) => {
    inspectedDay.current = timestamp
  }, [])
  const series = useMemo(() => dailyUsage(sessions, days), [sessions, days])
  const data = useMemo(
    () => series.map((day) => ({ ...day, value: day[metric] })),
    [series, metric],
  )
  const available = series.some((day) => day.messages > 0)
  const selectedIndex = series.findIndex((day) => day.timestamp === selectedDay)
  const format = metric === 'cost' ? money : tokens
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short',
        day: 'numeric',
      }),
    [language],
  )
  const date = useCallback((timestamp: number) => formatter.format(timestamp), [formatter])
  return (
    <section className="usage-trend usage-chart-panel" aria-label={t('usage.dailyUsage')}>
      <header className="usage-chart-heading">
        <h3>{t('usage.dailyUsage')}</h3>
        <ToggleButtonGroup
          className="usage-chart-range"
          aria-label={t('usage.chartRange')}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[String(days)]}
          onSelectionChange={(keys) => {
            const value = [...keys][0]
            if (value) {
              setDays(Number(value))
            }
          }}
        >
          {[30, 90].map((value) => (
            <ToggleButton key={value} id={String(value)}>
              {t('usage.chartDays', { count: value })}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </header>
      <div className="usage-trend-tools">
        <ToggleButtonGroup
          className="usage-chart-metric"
          aria-label={t('usage.chartMetric')}
          selectionMode="single"
          disallowEmptySelection
          isDetached
          selectedKeys={[metric]}
          onSelectionChange={(keys) => {
            if (keys.has('cost')) setMetric('cost')
            else if (keys.has('total')) setMetric('total')
          }}
        >
          <ToggleButton id="total">{t('usage.tokens')}</ToggleButton>
          <ToggleButton id="cost">{t('usage.cost')}</ToggleButton>
        </ToggleButtonGroup>
        {metric === 'cost' && <span className="usage-chart-unit">USD</span>}
      </div>
      {available ? (
        <div
          className="usage-area-plot"
          aria-label={t('usage.inspectChart')}
          aria-describedby={help}
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape') onSelectDay?.(null)
            if (event.key === 'Enter' && onSelectDay && inspectedDay.current !== null) {
              event.preventDefault()
              event.stopPropagation()
              onSelectDay(inspectedDay.current)
            }
          }}
        >
          <ResponsiveContainer
            width="100%"
            height={216}
            minWidth={0}
            initialDimension={{ width: 600, height: 216 }}
          >
            <AreaChart
              data={data}
              accessibilityLayer
              margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
              throttledEvents={['mousemove', 'touchmove']}
              desc={t('usage.inspectChart')}
              onClick={({ activeTooltipIndex }) => {
                if (activeTooltipIndex == null) return
                const day = series[Number(activeTooltipIndex)]
                if (day) onSelectDay?.(day.timestamp)
              }}
            >
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--usage-chart-color)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--usage-chart-color)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--ink)" strokeOpacity={0.1} />
              <XAxis
                dataKey="timestamp"
                axisLine={false}
                tickLine={false}
                tickFormatter={date}
                tickMargin={12}
                height={30}
                ticks={[
                  0,
                  Math.floor((days - 1) / 3),
                  Math.floor(((days - 1) * 2) / 3),
                  days - 1,
                ].map((index) => series[index].timestamp)}
                tick={{ fill: 'var(--muted)', fontSize: 13 }}
                minTickGap={12}
              />
              <YAxis
                width={54}
                axisLine={false}
                tickLine={false}
                tickFormatter={format}
                tickCount={3}
                domain={[0, 'auto']}
                tick={{ fill: 'var(--muted)', fontSize: 13 }}
              />
              <Tooltip
                defaultIndex={selectedIndex >= 0 ? selectedIndex : undefined}
                cursor={{ stroke: 'var(--muted)', strokeDasharray: '4 4' }}
                isAnimationActive={!reducedMotion}
                animationDuration={160}
                content={<UsageTooltip metric={metric} date={date} inspect={inspect} />}
              />
              {selectedIndex >= 0 && (
                <ReferenceLine x={selectedDay!} stroke="var(--muted)" strokeDasharray="4 4" />
              )}
              <Area
                dataKey="value"
                name={metric === 'cost' ? t('usage.cost') : t('usage.tokens')}
                type="monotone"
                stroke="var(--usage-chart-line)"
                strokeWidth={2}
                fill={`url(#${gradient})`}
                fillOpacity={1}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--paper)', strokeWidth: 2 }}
                isAnimationActive={!reducedMotion}
                animationDuration={450}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="usage-chart-empty" role="status">
          <ChartNoAxesCombined aria-hidden="true" />
          <p>{t('usage.noDatedUsage')}</p>
        </div>
      )}
      <div className="usage-chart-footer">
        <p className="usage-chart-note" id={help}>
          {t('usage.chartNote')}
          <span className="sr-only">
            {onSelectDay && available ? ` ${t('usage.selectDayHint')}` : ''}
          </span>
        </p>
      </div>
    </section>
  )
}
