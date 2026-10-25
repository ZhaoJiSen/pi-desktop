// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UsagePage } from '../../src/pages/UsagePage'
import { useWorkspace } from '../../src/store/workspace'
import {
  defaultUsageView,
  useUsageViewState,
  usageScroll,
} from '../../src/pages/usage/usageViewState'
import { createPreviewSessions, previewProjects } from '../../src/lib/fixtures'

vi.mock('../../src/router/navigation', () => ({ selectChat: vi.fn() }))
vi.mock('motion/react', async () => {
  const { createElement } = await import('react')
  return {
    useReducedMotion: () => true,
    motion: Object.fromEntries(
      ['div', 'span'].map((tag) => [
        tag,
        ({
          children,
          initial: _initial,
          animate: _animate,
          transition: _transition,
          layoutId: _layoutId,
          ...props
        }: Record<string, unknown>) => createElement(tag, props, children as React.ReactNode),
      ]),
    ),
  }
})
let host: HTMLDivElement
let root: Root
const initial = useWorkspace.getState()
async function click(label: string) {
  const button = [...host.querySelectorAll<HTMLElement>('button, [role="tab"]')].find(
    (el) => el.textContent === label || el.getAttribute('aria-label') === label,
  )
  expect(button, label).toBeTruthy()
  await act(async () => button!.click())
}
async function search(value: string) {
  const input = host.querySelector('input[type="search"]') as HTMLInputElement
  expect(input).toBeTruthy()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const bounds = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    // Happy DOM has no layout; give the real Recharts container a measured viewport.
    return this.classList.contains('recharts-responsive-container')
      ? new DOMRect(0, 0, 600, 216)
      : bounds.call(this)
  })
  localStorage.clear()
  useUsageViewState.setState({ ...defaultUsageView })
  usageScroll.remember(0)
  const sessions = createPreviewSessions()
  // A recorded session need not have its messages loaded to count toward usage.
  sessions[1] = {
    ...sessions[1],
    title: 'Higher spend',
    projectId: 'web-studio',
    usage: { ...sessions[0].usage, cost: 0.75, total: 24000 },
  }
  sessions[2] = { ...sessions[2], title: 'Awaiting stats', messages: sessions[0].messages }
  useWorkspace.setState({
    sessions,
    projects: previewProjects,
    activeSessionId: sessions[0].id,
    language: 'en',
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  useWorkspace.setState(initial)
  vi.restoreAllMocks()
})
describe('Usage page', () => {
  it('uses Recharts keyboard inspection and switches metric and date range', async () => {
    const sessions = useWorkspace.getState().sessions
    const first = new Date()
    first.setHours(1, 0, 0, 0)
    first.setDate(first.getDate() - 29)
    sessions[0] = {
      ...sessions[0],
      messages: [
        {
          id: 'dated',
          role: 'assistant',
          timestamp: first.getTime(),
          blocks: [],
          usage: { input: 90, output: 10, cacheRead: 0, cacheWrite: 0, total: 100, cost: 0.02 },
        },
      ],
    }
    useWorkspace.setState({ sessions: [...sessions] })
    await act(async () => root.render(createElement(UsagePage)))
    const chart = host.querySelector('[role="application"]') as SVGSVGElement
    expect(chart).toBeTruthy()
    expect(host.querySelector('.recharts-area')).toBeTruthy()
    await act(async () => chart.dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
    expect(host.querySelector('.usage-chart-tooltip')?.textContent).toContain('100 tokens')
    await act(async () =>
      chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    )
    expect(host.querySelector('.usage-chart-tooltip')?.textContent).toContain(
      'No usage recorded yet',
    )
    await act(async () =>
      chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })),
    )
    await click('Cost')
    expect(host.querySelector('.usage-chart-tooltip')?.textContent).toContain('$0.02')
    await click('90d')
    expect(useUsageViewState.getState().days).toBe(90)
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('$0.06')
  })
  it('links a library chart day to daily values and retains analysis after remount', async () => {
    const sessions = useWorkspace.getState().sessions
    const first = new Date()
    first.setHours(1, 0, 0, 0)
    first.setDate(first.getDate() - 89)
    sessions[0] = {
      ...sessions[0],
      messages: [
        {
          id: 'dated',
          role: 'assistant',
          timestamp: first.getTime(),
          blocks: [],
          usage: { input: 90, output: 10, cacheRead: 0, cacheWrite: 0, total: 100, cost: 0.02 },
        },
      ],
    }
    useWorkspace.setState({ sessions: [...sessions] })
    await act(async () => root.render(createElement(UsagePage)))
    await click('All sessions')
    await click('Cost')
    await click('90d')
    const chart = host.querySelector('[role="application"]') as SVGSVGElement
    await act(async () => chart.dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
    await act(async () =>
      chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    )
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(host.querySelector('tbody tr')?.textContent).toContain('$0.02')
    expect(host.querySelector('thead')?.textContent).toContain('Day cost')
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('$0.81')
    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(createElement(UsagePage)))
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      'All sessions',
    )
    expect(host.querySelector('.usage-trend .usage-chart-unit')?.textContent).toBe('USD')
    expect(useUsageViewState.getState().days).toBe(90)
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    await act(async () => (host.querySelector('.usage-clear-day') as HTMLButtonElement).click())
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3)
  })
  it('starts the calendar on January 1 and disables future dates', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 9, 25, 12).getTime())
    await act(async () => root.render(createElement(UsagePage)))
    const days = host.querySelectorAll('rect.usage-day')
    expect(days).toHaveLength(365)
    expect(days[0].getAttribute('data-date')).toBe('2026-01-01')
    expect(days[364].getAttribute('data-date')).toBe('2026-12-31')
    expect(
      [...host.querySelectorAll('.usage-heatmap-period time')].map((time) => time.textContent),
    ).toEqual(['2026-01-01', '2026-12-31'])
    const months = [...host.querySelectorAll('.react-activity-calendar__legend-month text')].map(
      (month) => month.textContent,
    )
    expect(months).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ])
    await click('All sessions')
    const future = host.querySelector<SVGRectElement>('rect[data-date="2026-12-31"]')!
    expect(future.getAttribute('aria-disabled')).toBe('true')
    expect(future.getAttribute('aria-label')).toContain('Upcoming date')
    await act(async () => future.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(useUsageViewState.getState().selectedDay).toBeNull()
    expect(
      [...host.querySelectorAll('.usage-heatmap-period time')].map((time) => time.textContent),
    ).toEqual(['2026-01-01', '2026-12-31'])
  })
  it('places project filtering beside the list and links the year calendar to daily usage', async () => {
    const sessions = useWorkspace.getState().sessions
    sessions[0] = {
      ...sessions[0],
      messages: [
        {
          id: 'today',
          role: 'assistant',
          timestamp: Date.now() - 1000,
          blocks: [],
          usage: { input: 90, output: 10, cacheRead: 0, cacheWrite: 0, total: 100, cost: 0.02 },
        },
      ],
    }
    useWorkspace.setState({ sessions: [...sessions] })
    await act(async () => root.render(createElement(UsagePage)))
    expect(host.querySelectorAll('rect.usage-day')).toHaveLength(365)
    await click('All sessions')
    expect(host.querySelector('.usage-toolbar .usage-project-select')).toBeNull()
    expect(host.querySelector('.usage-list-filters .usage-project-select')).toBeTruthy()
    const days = [...host.querySelectorAll<SVGRectElement>('rect.usage-day')]
    const today = days.filter((day) => day.getAttribute('aria-disabled') !== 'true').at(-1)!
    const todayIndex = days.indexOf(today)
    expect(today.getAttribute('aria-label')).toContain('100 tokens')
    await act(async () => today.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(host.querySelector('tbody tr')?.textContent).toContain('$0.02')
    expect(today.getAttribute('aria-pressed')).toBe('true')
    await click('View conversations (1)')
    expect(document.activeElement?.id).toBe('usage-list-heading')
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    await act(async () =>
      today.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    )
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3)
    await act(async () =>
      today.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })),
    )
    expect(document.activeElement).toBe(days[todayIndex - 7])
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      ),
    )
    expect(host.querySelectorAll('tbody tr')).toHaveLength(0)
    expect(host.textContent).toContain('No matching conversations')
    await click('Clear filters')
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3)
  })
  it('shows one current-session summary and a real navigation action', async () => {
    await act(async () => root.render(createElement(UsagePage)))
    expect(host.querySelector('h1')?.textContent).toBe('Usage')
    expect(host.querySelector('[role="tablist"]')).toBeTruthy()
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      'Current session',
    )
    expect(host.querySelector('table')).toBeNull()
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('$0.06')
    await click('Open conversation')
    const { selectChat } = await import('../../src/router/navigation')
    expect(selectChat).toHaveBeenCalledWith('model-selector')
  })
  it('keeps filtered totals consistent and includes usage without loaded messages', async () => {
    await act(async () => root.render(createElement(UsagePage)))
    await click('All sessions')
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('$0.81')
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3)
    expect(host.querySelector('tbody tr')?.textContent).toContain('Higher spend')
    expect(host.querySelector('.usage-footnote')?.textContent).toContain(
      '1 conversation has no recorded usage',
    )
    await search('Higher spend')
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('$0.75')
    await search('no-such-conversation')
    expect(host.querySelector('table')).toBeNull()
    expect(host.textContent).toContain('No matching conversations')
    expect(host.querySelector('.usage-view.is-empty')).toBeTruthy()
    expect(host.querySelector('.usage-project-select')).toBeTruthy()
    expect(host.querySelector('input[type="search"]')).toBeTruthy()
    expect(host.querySelector('.usage-overview')).toBeNull()
    await click('Clear filters')
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3)
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('$0.81')
  })
  it('filters by project and keeps the selection when changing scope', async () => {
    await act(async () => root.render(createElement(UsagePage)))
    await click('All sessions')
    const trigger = host.querySelector('.usage-project-select button') as HTMLButtonElement
    await act(async () => trigger.click())
    const option = [...document.querySelectorAll('[role="option"]')].find((el) =>
      el.textContent?.includes('web-studio'),
    ) as HTMLElement
    expect(option).toBeTruthy()
    await act(async () => option.click())
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(host.querySelector('tbody tr')?.textContent).toContain('Higher spend')
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('$0.75')
    await click('Current session')
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('$0.06')
    await click('All sessions')
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('$0.75')
  })
  it('sorts costs both ways while keeping unrecorded usage last', async () => {
    await act(async () => root.render(createElement(UsagePage)))
    await click('All sessions')
    await click('Estimated cost')
    expect(host.querySelector('tbody tr')?.textContent).toContain('模型选择器交互优化')
    expect([...host.querySelectorAll('tbody tr')].at(-1)?.textContent).toContain('Awaiting stats')
    expect(host.querySelector('th[aria-sort="ascending"]')?.textContent).toBe('Est. cost')
    await click('Estimated cost')
    expect(host.querySelector('tbody tr')?.textContent).toContain('Higher spend')
  })
  it('keeps missing selection and tiny positive cost distinct from zero', async () => {
    useWorkspace.setState({ activeSessionId: null })
    await act(async () => root.render(createElement(UsagePage)))
    expect(host.textContent).toContain('No conversation selected')
    expect(host.querySelector('.usage-overview')).toBeNull()
    await act(async () =>
      useWorkspace.setState({
        activeSessionId: 'model-selector',
        sessions: useWorkspace
          .getState()
          .sessions.map((item) =>
            item.id === 'model-selector'
              ? { ...item, usage: { ...item.usage, cost: 0.000001 } }
              : item,
          ),
      }),
    )
    expect(host.querySelector('.usage-primary dd')?.textContent).toBe('< $0.0001')
  })
  it('shows a useful empty state without metrics or cost explanations', async () => {
    // Use an actual session with no recorded usage.
    const empty = useWorkspace.getState().sessions[2]
    useWorkspace.setState({ activeSessionId: empty.id })
    await act(async () => root.render(createElement(UsagePage)))
    expect(host.textContent).toContain('No usage recorded yet')
    expect(host.querySelector('.usage-overview')).toBeNull()
    expect(host.querySelector('.usage-composition')).toBeNull()
    expect(host.querySelector('.usage-cost-notice')).toBeNull()
    expect(host.querySelector('.usage-footnote')).toBeNull()
    expect(host.querySelector('.usage-view.is-empty')).toBeTruthy()
    expect(host.querySelector('.usage-session-heading')).toBeNull()
    expect(host.querySelector('.usage-empty-context')?.textContent).toContain(empty.title)
    await click('Open conversation')
    const { selectChat } = await import('../../src/router/navigation')
    expect(selectChat).toHaveBeenCalledWith(empty.id)
  })
  it('hides all unused table controls when no conversations have any activity', async () => {
    const sessions = useWorkspace.getState().sessions.map((item) => ({
      ...item,
      messages: [],
      usage: { ...item.usage, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0 },
    }))
    useWorkspace.setState({ sessions })
    await act(async () => root.render(createElement(UsagePage)))
    await click('All sessions')
    expect(host.querySelector('.usage-view.is-empty')).toBeTruthy()
    expect(host.querySelector('.usage-project-select')).toBeNull()
    expect(host.querySelector('.usage-list-toolbar')).toBeNull()
    expect(host.querySelector('input[type="search"]')).toBeNull()
    expect(host.querySelector('table')).toBeNull()
    expect(host.textContent).toContain('No usage recorded yet')
  })
  it('remembers dismissal after remount and keeps the complete explanation accessible', async () => {
    await act(async () => root.render(createElement(UsagePage)))
    expect(host.querySelector('.usage-cost-notice')?.getAttribute('role')).toBe('note')
    await click('Dismiss cost information')
    expect(host.querySelector('.usage-cost-notice')).toBeNull()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('About estimated costs')
    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(createElement(UsagePage)))
    expect(host.querySelector('.usage-cost-notice')).toBeNull()
    await click('About estimated costs')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'zero cost does not necessarily mean free usage',
    )
  })
  it('still dismisses for the current visit when preference storage fails', async () => {
    const read = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('unavailable')
    })
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('unavailable')
    })
    await act(async () => root.render(createElement(UsagePage)))
    expect(host.querySelector('.usage-cost-notice')).toBeTruthy()
    await click('Dismiss cost information')
    expect(host.querySelector('.usage-cost-notice')).toBeNull()
    expect(write).toHaveBeenCalled()
    expect(read).toHaveBeenCalled()
    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(createElement(UsagePage)))
    expect(host.querySelector('.usage-cost-notice')).toBeTruthy()
  })
})
